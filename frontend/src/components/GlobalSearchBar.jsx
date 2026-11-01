import { useState, useEffect, useRef } from 'react';
import {
  SearchIcon,
  UsersIcon,
  FolderIcon,
  CheckCircleIcon,
  CheckSquareIcon,
  MessageSquareIcon,
  VideoIcon,
  FileTextIcon,
  ArrowRightIcon,
  SparklesIcon,
} from './Icons';
import { api } from '../services/api';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'employees', label: 'Employees', icon: UsersIcon },
  { id: 'projects', label: 'Projects', icon: FolderIcon },
  { id: 'milestones', label: 'Milestones', icon: CheckCircleIcon },
  { id: 'tasks', label: 'Tasks', icon: CheckSquareIcon },
  { id: 'groups', label: 'Groups', icon: UsersIcon },
  { id: 'messages', label: 'Messages', icon: MessageSquareIcon },
  { id: 'meetings', label: 'Meetings', icon: VideoIcon },
  { id: 'documents', label: 'Documents', icon: FileTextIcon },
];

export const GlobalSearchBar = ({ onSelectResult }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({
    query: '',
    category: 'all',
    counts: {
      employees: 0,
      projects: 0,
      milestones: 0,
      tasks: 0,
      groups: 0,
      messages: 0,
      meetings: 0,
      documents: 0,
    },
    total: 0,
    results: {
      employees: [],
      projects: [],
      milestones: [],
      tasks: [],
      groups: [],
      messages: [],
      meetings: [],
      documents: [],
    },
  });

  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Global Keyboard Shortcut: Focus on Ctrl+K / Cmd+K or "/"
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        return;
      }

      // "/" key when not typing in an editable field
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        !document.activeElement?.isContentEditable
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        return;
      }

      // Escape key closes search
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search query
  useEffect(() => {
    if (!searchTerm.trim()) {
      setIsLoading(false);
      setSearchResults({
        query: '',
        category: activeCategory,
        counts: { employees: 0, projects: 0, milestones: 0, tasks: 0, groups: 0, messages: 0, meetings: 0, documents: 0 },
        total: 0,
        results: { employees: [], projects: [], milestones: [], tasks: [], groups: [], messages: [], meetings: [], documents: [] },
      });
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.globalSearch(searchTerm, activeCategory);
        if (data && data.results) {
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, activeCategory]);

  const handleClear = () => {
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleItemClick = (item) => {
    setIsOpen(false);
    if (onSelectResult) {
      onSelectResult(item);
    }
  };

  // Helper to render matched text with bold highlight
  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getCategoryIcon = (type) => {
    switch (type) {
      case 'employee':
        return <UsersIcon size={14} className="text-primary" />;
      case 'project':
        return <FolderIcon size={14} className="text-accent" />;
      case 'milestone':
        return <CheckCircleIcon size={14} className="text-emerald" />;
      case 'task':
        return <CheckSquareIcon size={14} className="text-blue" />;
      case 'group':
        return <UsersIcon size={14} className="text-purple" />;
      case 'message':
        return <MessageSquareIcon size={14} className="text-amber" />;
      case 'meeting':
        return <VideoIcon size={14} className="text-indigo" />;
      case 'document':
        return <FileTextIcon size={14} className="text-rose" />;
      default:
        return <SparklesIcon size={14} className="text-primary" />;
    }
  };

  const renderCategoryList = (categoryKey, title, items) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="search-category-section" key={categoryKey}>
        <div className="search-category-header">
          <span>{title}</span>
          <span className="search-category-count">{items.length}</span>
        </div>
        <div className="search-category-items">
          {items.map((item, idx) => (
            <div
              key={item.id || idx}
              className="search-result-item"
              onClick={() => handleItemClick(item)}
            >
              <div className="search-item-icon-box">
                {getCategoryIcon(item.type)}
              </div>
              <div className="search-item-info">
                <div className="search-item-title">
                  {highlightMatch(item.title, searchTerm)}
                </div>
                {item.subtitle && (
                  <div className="search-item-subtitle">
                    {item.subtitle}
                  </div>
                )}
              </div>
              <div className="search-item-action">
                <ArrowRightIcon size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="global-search-container" ref={searchContainerRef}>
      {/* Search Bar Input */}
      <div className={`global-search-input-wrap ${isOpen ? 'active' : ''}`}>
        <SearchIcon size={16} className="search-input-icon" />
        <input
          ref={inputRef}
          type="text"
          className="global-search-input"
          placeholder="Search employees, projects, milestones, tasks, meetings... (Ctrl+K)"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (searchTerm.trim().length > 0) setIsOpen(true);
          }}
        />

        {searchTerm && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={handleClear}
            title="Clear search"
          >
            ✕
          </button>
        )}

        <div className="search-shortcut-pill" title="Press Ctrl+K or / to search">
          <span>⌘K</span>
        </div>
      </div>

      {/* Dropdown Overlay Results */}
      {isOpen && searchTerm.trim().length > 0 && (
        <div className="global-search-dropdown animate-fade-in">
          {/* Category Tabs */}
          <div className="search-categories-bar">
            {CATEGORIES.map((cat) => {
              const count =
                cat.id === 'all'
                  ? searchResults.total
                  : searchResults.counts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`search-cat-tab ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span>{cat.label}</span>
                  <span className="search-tab-badge">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Results Scroll Area */}
          <div className="search-results-body">
            {isLoading ? (
              <div className="search-loading-state">
                <div className="search-spinner"></div>
                <p>Searching across organization records...</p>
              </div>
            ) : searchResults.total === 0 ? (
              <div className="search-zero-state">
                <SearchIcon size={28} className="zero-icon" />
                <h4>No records found</h4>
                <p>No matching employees, projects, milestones, tasks, or documents found for "{searchTerm}".</p>
              </div>
            ) : (
              <div className="search-results-list">
                {(activeCategory === 'all' || activeCategory === 'employees') &&
                  renderCategoryList('employees', 'Employees', searchResults.results.employees)}

                {(activeCategory === 'all' || activeCategory === 'projects') &&
                  renderCategoryList('projects', 'Projects', searchResults.results.projects)}

                {(activeCategory === 'all' || activeCategory === 'milestones') &&
                  renderCategoryList('milestones', 'Milestones', searchResults.results.milestones)}

                {(activeCategory === 'all' || activeCategory === 'tasks') &&
                  renderCategoryList('tasks', 'Tasks', searchResults.results.tasks)}

                {(activeCategory === 'all' || activeCategory === 'groups') &&
                  renderCategoryList('groups', 'Groups', searchResults.results.groups)}

                {(activeCategory === 'all' || activeCategory === 'messages') &&
                  renderCategoryList('messages', 'Messages & Notifications', searchResults.results.messages)}

                {(activeCategory === 'all' || activeCategory === 'meetings') &&
                  renderCategoryList('meetings', 'Meetings', searchResults.results.meetings)}

                {(activeCategory === 'all' || activeCategory === 'documents') &&
                  renderCategoryList('documents', 'Documents & Deliverables', searchResults.results.documents)}
              </div>
            )}
          </div>

          {/* Search Footer */}
          <div className="search-footer-info">
            <span>
              Found <strong>{searchResults.total}</strong> record{searchResults.total === 1 ? '' : 's'} matching "{searchTerm}"
            </span>
            <span className="search-key-hint">Press <strong>ESC</strong> to close</span>
          </div>
        </div>
      )}
    </div>
  );
};
