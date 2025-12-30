import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';

interface ResponsiveModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Desktop modal size - default is 'md' */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Show close button in header */
  showCloseButton?: boolean;
  /** Custom header content (replaces title) */
  header?: ReactNode;
  /** Footer content */
  footer?: ReactNode;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

export function ResponsiveModal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  header,
  footer,
}: ResponsiveModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle open/close animations for desktop
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before hiding
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Mobile: Use Vaul Drawer
  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-[60]" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] flex flex-col bg-dark-800 rounded-t-2xl max-h-[96dvh] outline-none">
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-dark-600 rounded-full" />
            </div>

            {/* Header */}
            {(title || header || showCloseButton) && (
              <div className="flex items-center justify-between px-4 pb-3 border-b border-dark-700">
                {header || (
                  <Drawer.Title className="text-lg font-bold text-white">
                    {title}
                  </Drawer.Title>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 overscroll-contain">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-4 border-t border-dark-700 safe-area-bottom">
                {footer}
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  // Desktop: Use Modal with animations
  if (!isVisible && !isMobile) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-6 transition-all duration-200 ease-out ${
        isAnimating ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none'
      }`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`bg-dark-800 rounded-2xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col border border-dark-700 shadow-2xl transition-all duration-200 ease-out ${
          isAnimating
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        {/* Header */}
        {(title || header || showCloseButton) && (
          <div className="flex items-center justify-between p-5 border-b border-dark-700">
            {header || <h2 className="text-xl font-bold text-white">{title}</h2>}
            {showCloseButton && (
              <button
                onClick={handleClose}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X size={22} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-5 border-t border-dark-700">{footer}</div>
        )}
      </div>
    </div>
  );
}

export default ResponsiveModal;
