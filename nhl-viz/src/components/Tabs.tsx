import { motion } from 'motion/react';

interface TabItem<T> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
}

export function Tabs<T extends string>({ items, value, onChange, layoutId }: Props<T>) {
  return (
    <nav className="tabs-nav" role="tablist">
      <ul>
        {items.map(item => {
          const isSelected = item.value === value;
          return (
            <li
              key={item.value}
              role="tab"
              aria-selected={isSelected}
              className={isSelected ? 'tabs-item selected' : 'tabs-item'}
            >
              {isSelected && (
                <motion.div
                  layoutId={layoutId}
                  className="tabs-indicator"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                />
              )}
              <motion.button
                className="tabs-btn"
                onTapStart={() => onChange(item.value)}
                whileTap={{ scale: 0.92 }}
              >
                {item.label}
              </motion.button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
