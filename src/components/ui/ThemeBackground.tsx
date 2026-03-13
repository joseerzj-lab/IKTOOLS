import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const ThemeBackground: React.FC = () => {
    const { theme } = useTheme();

    if (theme !== 'landscape') return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            pointerEvents: 'none',
            overflow: 'hidden',
            backgroundImage: `url("${import.meta.env.BASE_URL}landscape.jpg")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
        }}>
            {/* Overlay for legibility */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.25)',
                backdropFilter: 'blur(3px)',
            }} />
        </div>
    );
};
