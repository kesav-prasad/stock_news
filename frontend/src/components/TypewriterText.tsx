'use client';

import { useState, useEffect, useRef } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;        // ms per character
  startDelay?: number;   // ms before typing starts
  className?: string;
  onComplete?: () => void;
}

// Cache to remember which strings have already been animated in this session
const animatedStrings = new Set<string>();

export default function TypewriterText({ 
  text, 
  speed = 25, 
  startDelay = 300,
  className = '',
  onComplete 
}: TypewriterTextProps) {
  const isAlreadyDone = animatedStrings.has(text);
  const [displayedText, setDisplayedText] = useState(isAlreadyDone ? text : '');
  const [isComplete, setIsComplete] = useState(isAlreadyDone);
  const [hasStarted, setHasStarted] = useState(isAlreadyDone);
  const prevTextRef = useRef(text);

  useEffect(() => {
    if (!text) return;

    // If text changed, or it hasn't been animated yet, reset
    if (text !== prevTextRef.current) {
      if (animatedStrings.has(text)) {
        setDisplayedText(text);
        setIsComplete(true);
        setHasStarted(true);
      } else {
        setDisplayedText('');
        setIsComplete(false);
        setHasStarted(false);
      }
      prevTextRef.current = text;
    }
    
    if (isComplete || animatedStrings.has(text)) return;

    const startTimer = setTimeout(() => {
      setHasStarted(true);
    }, startDelay);

    return () => clearTimeout(startTimer);
  }, [text, startDelay, isComplete]);

  useEffect(() => {
    if (!hasStarted || !text || isComplete || animatedStrings.has(text)) return;

    let charIndex = 0;
    
    const typeInterval = setInterval(() => {
      charIndex++;
      setDisplayedText(text.slice(0, charIndex));

      if (charIndex >= text.length) {
        clearInterval(typeInterval);
        setIsComplete(true);
        animatedStrings.add(text);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(typeInterval);
  }, [hasStarted, text, speed, onComplete, isComplete]);

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && hasStarted && (
        <span className="inline-block w-[2px] h-[1em] bg-indigo-500 dark:bg-indigo-400 ml-0.5 align-middle animate-blink" />
      )}
    </span>
  );
}
