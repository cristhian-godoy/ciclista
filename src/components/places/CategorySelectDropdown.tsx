import { Check, ChevronDown } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import { SearchInput } from '../common/SearchInput';
import { CATEGORY_MAP, PLACE_CATEGORIES, type PlaceCategory } from './types';

/**
 * Properties for CategorySelectDropdown component.
 */
export interface CategorySelectDropdownProps {
  category: PlaceCategory | '';
  onSelectCategory: (category: PlaceCategory) => void;
  labelId?: string;
  triggerId?: string;
}

/**
 * Searchable, keyboard-accessible dropdown for selecting a place category.
 */
export const CategorySelectDropdown: React.FC<CategorySelectDropdownProps> = ({
  category,
  onSelectCategory,
  labelId = 'ciclista-place-category-label',
  triggerId = 'ciclista-place-category-trigger',
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredCategories = useMemo(() => {
    if (!searchFilter.trim()) {
      return PLACE_CATEGORIES;
    }
    const q = searchFilter.trim().toLowerCase();
    return PLACE_CATEGORIES.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [searchFilter]);

  const selectedCategoryOption = useMemo(() => {
    if (!category) {
      return null;
    }
    return CATEGORY_MAP.get(category) ?? null;
  }, [category]);

  // Handle outside click to close category dropdown
  useOnClickOutside(dropdownRef, () => setIsDropdownOpen(false), isDropdownOpen);

  // Handle Escape key to close category dropdown and refocus trigger
  useEscapeKey(() => {
    setIsDropdownOpen(false);
    triggerRef.current?.focus();
  }, isDropdownOpen);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      searchInputRef.current?.focus();
    }
  }, [isDropdownOpen]);

  const handleOpenDropdown = () => {
    setHighlightedIndex(0);
    setSearchFilter('');
    setIsDropdownOpen(true);
  };

  const handleSelect = (newCategory: PlaceCategory) => {
    onSelectCategory(newCategory);
    setIsDropdownOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenDropdown();
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < filteredCategories.length ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCategories[highlightedIndex];
      if (selected) {
        handleSelect(selected.category);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsDropdownOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div className="ciclista-searchable-dropdown" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        id={triggerId}
        className="ciclista-select ciclista-category-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen}
        aria-labelledby={`${labelId} ${triggerId}`}
        onClick={() => setIsDropdownOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="ciclista-category-trigger-content">
          {selectedCategoryOption ? (
            <>
              {selectedCategoryOption.icon}
              <span>{selectedCategoryOption.label}</span>
            </>
          ) : (
            <span className="ciclista-placeholder-text">Select category...</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`ciclista-dropdown-chevron ${isDropdownOpen ? 'ciclista-dropdown-chevron--open' : ''}`}
        />
      </button>

      {isDropdownOpen && (
        <div className="ciclista-category-dropdown-menu" role="listbox" aria-labelledby={labelId}>
          <SearchInput
            ref={searchInputRef}
            placeholder="Search category..."
            value={searchFilter}
            onChange={setSearchFilter}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search category"
            containerClassName="ciclista-category-dropdown-search"
            inputClassName="ciclista-category-search-input"
            iconSize={14}
          />

          <ul className="ciclista-category-options-list">
            {filteredCategories.length === 0 ? (
              <li className="ciclista-category-option-empty">No categories found</li>
            ) : (
              filteredCategories.map((opt, index) => {
                const isSelected = category === opt.category;
                const isHighlighted = highlightedIndex === index;
                return (
                  <li
                    key={opt.category}
                    role="option"
                    aria-selected={isSelected}
                    className={`ciclista-category-option ${isSelected ? 'selected' : ''} ${
                      isHighlighted ? 'ciclista-category-option--highlighted' : ''
                    }`}
                    onClick={() => handleSelect(opt.category)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <span className="ciclista-category-option-icon">{opt.icon}</span>
                    <span className="ciclista-category-option-label">{opt.label}</span>
                    {isSelected && <Check size={14} className="ciclista-category-option-check" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
