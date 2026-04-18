'use client';

import { useState, useEffect, useRef } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;        // ms per character
  startDelay?: number;   // ms before typing starts
  className?: string;
  onComplete?: () => void;
}

export default function TypewriterText({ 
  text, 
  speed = 25, 
  startDelay = 300,
  className = '',
  onComplete 
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const prevTextRef = useRef('');

  useEffect(() => {
    if (!text) return;

    // If the text hasn't changed, don't re-animate
    if (text === prevTextRef.current && isComplete) return;
    prevTextRef.current = text;

    setDisplayedText('');
    setIsComplete(false);
    setHasStarted(false);

    const startTimer = setTimeout(() => {
      setHasStarted(true);
    }, startDelay);

    return () => clearTimeout(startTimer);
  }, [text, startDelay]);

  useEffect(() => {
    if (!hasStarted || !text) return;

    let charIndex = 0;
    
    const typeInterval = setInterval(() => {
      charIndex++;
      setDisplayedText(text.slice(0, charIndex));

      if (charIndex >= text.length) {
        clearInterval(typeInterval);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(typeInterval);
  }, [hasStarted, text, speed, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && hasStarted && (
        <span className="inline-block w-[2px] h-[1em] bg-indigo-500 dark:bg-indigo-400 ml-0.5 align-middle animate-blink" />
      )}
    </span>
  );
}
