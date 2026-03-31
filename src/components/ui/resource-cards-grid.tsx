import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// Define the type for each card item
export interface ResourceCardItem {
  iconSrc?: string;
  icon?: React.ReactNode;
  title: string;
  lastUpdated?: string;
  description?: string;
  href: string;
}

// Define the props for the main grid component
interface ResourceCardsGridProps {
  items: ResourceCardItem[];
  className?: string;
  isGlass?: boolean;
}

// Animation variants for the container to orchestrate children animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Animation variants for each card item
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
};

export const ResourceCardsGrid = ({ items, className, isGlass }: ResourceCardsGridProps) => {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {items.map((item, index) => {
        const isExternal = item.href.startsWith("http");
        
        const cardClasses = cn(
          "flex h-full flex-col justify-between rounded-xl border p-6 transition-all duration-500 group",
          isGlass 
            ? "bg-slate-900/40 backdrop-blur-xl border-white/10 hover:border-white/30 hover:bg-slate-800/50 hover:shadow-[0_0_30px_rgba(56,139,253,0.15)]" 
            : "border-border bg-card hover:bg-muted/50 shadow-sm hover:shadow-md",
        );

        const content = (
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {item.iconSrc ? (
                <img src={item.iconSrc} alt={`${item.title} icon`} className="h-10 w-10" />
              ) : (
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                  isGlass ? "bg-white/10 text-white" : "bg-muted text-muted-foreground group-hover:text-primary"
                )}>
                  {item.icon}
                </div>
              )}
              <div>
                <h3 className={cn(
                  "text-lg font-semibold",
                  isGlass ? "text-white" : "text-card-foreground"
                )}>
                  {item.title}
                </h3>
                {item.lastUpdated && (
                  <p className={cn(
                    "text-sm",
                    isGlass ? "text-white/60" : "text-muted-foreground"
                  )}>
                    Last updated: {item.lastUpdated}
                  </p>
                )}
                {item.description && (
                  <p className={cn(
                    "text-sm mt-1 line-clamp-2",
                    isGlass ? "text-white/60" : "text-muted-foreground"
                  )}>
                    {item.description}
                  </p>
                )}
              </div>
            </div>
            <ArrowUpRight className={cn(
              "h-5 w-5 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1",
              isGlass ? "text-white/70" : "text-muted-foreground"
            )} />
          </div>
        );

        if (isExternal) {
          return (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="group block h-full"
            >
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClasses}
              >
                {content}
              </a>
            </motion.div>
          );
        }

        return (
          <motion.div
            key={index}
            variants={itemVariants}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group block h-full"
          >
            <Link
              to={item.href}
              className={cardClasses}
            >
              {content}
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

