'use client';
import { useId } from 'react';
import { SearchIcon } from './Icons';

export default function SearchInput({ value, onChange, placeholder, label }) {
  const id = useId();
  return (
    <div className="search">
      <label htmlFor={id} className="sr-only">{label || placeholder}</label>
      <SearchIcon size={16} className="search-icon" />
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
