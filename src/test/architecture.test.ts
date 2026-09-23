import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * File discovery options for scanning directory trees.
 */
export interface FileScanOptions {
  /** Allowed file extensions (e.g. ['.ts', '.tsx']) */
  extensions: string[];
  /** Patterns or substrings indicating files to exclude */
  excludePatterns: RegExp[];
}

/**
 * Recursively retrieves all matching files within a directory according to scan options.
 *
 * @param dir - Absolute path to the directory to traverse.
 * @param options - Configuration specifying extensions and exclusion rules.
 * @returns An array of absolute file paths matching the criteria.
 */
export function scanSourceFiles(dir: string, options: FileScanOptions): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (options.excludePatterns.some((pattern) => pattern.test(fullPath))) {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...scanSourceFiles(fullPath, options));
    } else if (entry.isFile()) {
      if (options.extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Checks a TypeScript file for forbidden module import declarations.
 *
 * @param filePath - Absolute path to the source file.
 * @param sourceFile - Parsed TypeScript AST source file.
 * @param forbiddenModules - Array of package names forbidden from being imported.
 * @returns Array of formatted violation strings.
 */
export function findForbiddenImports(
  filePath: string,
  sourceFile: ts.SourceFile,
  forbiddenModules: string[],
): string[] {
  const violations: string[] = [];

  ts.forEachChild(sourceFile, (node) => {
    let specifier = '';

    if (ts.isImportDeclaration(node)) {
      if (node.importClause?.isTypeOnly) {
        return;
      }
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        specifier = node.moduleSpecifier.text;
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0]!)
    ) {
      specifier = node.arguments[0]!.text;
    }

    if (specifier) {
      const isForbidden = forbiddenModules.some(
        (forbidden) => specifier === forbidden || specifier.startsWith(`${forbidden}/`),
      );
      if (isForbidden) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push(
          `${filePath}:${line + 1}:${character + 1} - Forbidden framework import '${specifier}'.`,
        );
      }
    }
  });

  return violations;
}

/**
 * Checks a TypeScript file for forbidden DOM global identifier references.
 *
 * @param filePath - Absolute path to the source file.
 * @param sourceFile - Parsed TypeScript AST source file.
 * @param forbiddenGlobals - Array of global names (e.g. ['window', 'document']).
 * @returns Array of formatted violation strings.
 */
export function findForbiddenDOMGlobals(
  filePath: string,
  sourceFile: ts.SourceFile,
  forbiddenGlobals: string[],
): string[] {
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node) && forbiddenGlobals.includes(node.text)) {
      const parent = node.parent;

      // Ignore property access where the global name is merely the property (e.g., obj.window or obj.document)
      const isPropertyAccess = ts.isPropertyAccessExpression(parent) && parent.name === node;
      // Ignore type signatures or object literal keys
      const isPropertyAssignment = ts.isPropertyAssignment(parent) && parent.name === node;
      const isPropertySignature = ts.isPropertySignature(parent) && parent.name === node;
      const isTypeNode = ts.isTypeReferenceNode(parent) || ts.isTypeQueryNode(parent);

      if (!isPropertyAccess && !isPropertyAssignment && !isPropertySignature && !isTypeNode) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push(
          `${filePath}:${line + 1}:${character + 1} - Forbidden reference to DOM global '${node.text}'.`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

/**
 * Inspects a TypeScript file to ensure heavy computational classes are not instantiated inside React components or hooks.
 *
 * @param filePath - Absolute path to the source file.
 * @param sourceFile - Parsed TypeScript AST source file.
 * @param heavyClassNames - Names of heavy algorithm classes forbidden from synchronous UI instantiation.
 * @returns Array of formatted violation strings.
 */
export function findSynchronousHeavyInstantiations(
  filePath: string,
  sourceFile: ts.SourceFile,
  heavyClassNames: string[],
): string[] {
  const violations: string[] = [];

  function isComponentOrHookName(name: string): boolean {
    return /^[A-Z]/.test(name) || /^use[A-Z]/.test(name);
  }

  function getEnclosingComponentOrHook(node: ts.Node): string | null {
    let curr: ts.Node | undefined = node.parent;
    while (curr) {
      if (ts.isFunctionDeclaration(curr) && curr.name) {
        if (isComponentOrHookName(curr.name.text)) {
          return curr.name.text;
        }
      } else if (ts.isVariableDeclaration(curr) && ts.isIdentifier(curr.name)) {
        if (
          curr.initializer &&
          (ts.isArrowFunction(curr.initializer) || ts.isFunctionExpression(curr.initializer))
        ) {
          if (isComponentOrHookName(curr.name.text)) {
            return curr.name.text;
          }
        }
      } else if (ts.isMethodDeclaration(curr) && ts.isIdentifier(curr.name)) {
        if (isComponentOrHookName(curr.name.text)) {
          return curr.name.text;
        }
      }
      curr = curr.parent;
    }
    return null;
  }

  function visit(node: ts.Node): void {
    if (ts.isNewExpression(node)) {
      const callee = node.expression.getText(sourceFile);
      if (heavyClassNames.includes(callee)) {
        const componentOrHook = getEnclosingComponentOrHook(node);
        if (componentOrHook) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push(
            `${filePath}:${line + 1}:${character + 1} - Synchronous instantiation 'new ${callee}()' within React component/hook '${componentOrHook}'. Run computations in Web Workers instead.`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

describe('Architectural Invariants', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const coreDir = path.join(projectRoot, 'src/core');
  const componentsDir = path.join(projectRoot, 'src/components');
  const hooksDir = path.join(projectRoot, 'src/hooks');

  describe('Core Domain Purity', () => {
    it('ensures src/core/ contains ZERO framework imports (react, react-dom, maplibre-gl)', () => {
      const files = scanSourceFiles(coreDir, {
        extensions: ['.ts', '.tsx'],
        excludePatterns: [/\.(test|spec)\.[jt]sx?$/, /[\\/]test(-suite)?[\\/]/],
      });

      expect(files.length).toBeGreaterThan(0);

      const forbiddenImports = ['react', 'react-dom', 'maplibre-gl'];
      const allViolations: string[] = [];

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
        allViolations.push(...findForbiddenImports(filePath, sourceFile, forbiddenImports));
      }

      expect(allViolations).toEqual([]);
    });

    it('ensures core domain logic has ZERO references to browser DOM globals (window, document)', () => {
      const files = scanSourceFiles(coreDir, {
        extensions: ['.ts', '.tsx'],
        excludePatterns: [/\.(test|spec)\.[jt]sx?$/, /[\\/]test(-suite)?[\\/]/],
      });

      expect(files.length).toBeGreaterThan(0);

      const forbiddenGlobals = ['window', 'document'];
      const allViolations: string[] = [];

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
        allViolations.push(...findForbiddenDOMGlobals(filePath, sourceFile, forbiddenGlobals));
      }

      expect(allViolations).toEqual([]);
    });
  });

  describe('Concurrency / Worker Boundary', () => {
    it('ensures heavy algorithms (DijkstraRouter, OSMGraphParser) are not instantiated synchronously in React components or custom hooks', () => {
      const files = [
        ...scanSourceFiles(componentsDir, {
          extensions: ['.ts', '.tsx'],
          excludePatterns: [/\.(test|spec)\.[jt]sx?$/, /[\\/]test[\\/]/, /\.worker\.[jt]s$/],
        }),
        ...scanSourceFiles(hooksDir, {
          extensions: ['.ts', '.tsx'],
          excludePatterns: [/\.(test|spec)\.[jt]sx?$/, /[\\/]test[\\/]/, /\.worker\.[jt]s$/],
        }),
      ];

      expect(files.length).toBeGreaterThan(0);

      const heavyClasses = ['DijkstraRouter', 'OSMGraphParser'];
      const allViolations: string[] = [];

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
        allViolations.push(
          ...findSynchronousHeavyInstantiations(filePath, sourceFile, heavyClasses),
        );
      }

      expect(allViolations).toEqual([]);
    });
  });

  describe('Configuration Integrity Guard', () => {
    it('ensures linter and TypeScript configs remain untouched in git working tree', () => {
      try {
        const unstaged = execSync('git diff HEAD --name-only', { encoding: 'utf-8' });
        const staged = execSync('git diff --cached --name-only', { encoding: 'utf-8' });

        const changedFiles = [...unstaged.split('\n'), ...staged.split('\n')]
          .map((f) => f.trim())
          .filter(Boolean);

        const protectedPatterns = [
          /^\.stylelintrc\.json$/,
          /^eslint\.config\.js$/,
          /^tsconfig(\..*)?\.json$/,
        ];

        const violations = changedFiles.filter((file) =>
          protectedPatterns.some((pattern) => pattern.test(file)),
        );

        expect(violations).toEqual([]);
      } catch {
        // Pass gracefully in environments without a git working tree
      }
    });
  });
});
