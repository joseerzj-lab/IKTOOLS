"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme, getThemeColors } from "@/context/ThemeContext";

type DropdownMenuProps = {
  options: {
    label: string;
    onClick: () => void;
    Icon?: React.ReactNode;
  }[];
  children: React.ReactNode;
  closeOnSelect?: boolean;
};

const DropdownMenu = ({ options, children, closeOnSelect = true }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, isDark } = useTheme();
  const TC = getThemeColors(theme);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <Button
        onClick={toggleDropdown}
        className="px-4 py-2 shadow-lg rounded-xl backdrop-blur-md transition-all flex items-center gap-2 group border"
        style={{ 
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          borderColor: TC.border,
          color: TC.text
        }}
      >
        {children ?? "Menu"}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.4, ease: "easeInOut", type: "spring" }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: -5, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -5, scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.3, ease: "circOut" }}
            className="absolute z-50 w-56 mt-2 p-1 rounded-xl shadow-2xl backdrop-blur-2xl flex flex-col gap-1 border overflow-hidden"
            style={{ 
              background: TC.headerBg, 
              borderColor: TC.border,
              boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.1)'
            }}
          >
            {options && options.length > 0 ? (
              options.map((option) => (
                <motion.button
                  whileHover={{ backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                  whileTap={{ scale: 0.97 }}
                  key={option.label}
                  onClick={() => {
                    option.onClick();
                    if (closeOnSelect) setIsOpen(false);
                  }}
                  className="px-3 py-2.5 cursor-pointer text-sm rounded-lg w-full text-left flex items-center gap-x-3 transition-colors outline-none"
                  style={{ color: TC.text }}
                >
                  {option.Icon}
                  <span className="flex-1 font-medium">{option.label}</span>
                </motion.button>
              ))
            ) : (
              <div className="px-4 py-3 text-xs opacity-50 italic" style={{ color: TC.text }}>No hay opciones</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { DropdownMenu };
