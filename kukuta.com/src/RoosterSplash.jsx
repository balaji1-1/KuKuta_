import React, { useEffect, useRef, useState } from 'react';
import './RoosterSplash.css';

const RoosterSplash = ({ onAnimationComplete }) => {
  const [isComplete, setIsComplete] = useState(false);
  const onAnimationCompleteRef = useRef(onAnimationComplete);

  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsComplete(true);
      if (onAnimationCompleteRef.current) {
        onAnimationCompleteRef.current();
      }
    }, 1900);

    return () => clearTimeout(timer);
  }, []);

  if (isComplete) {
    return null;
  }

  return (
    <div className="rooster-splash wordmark-splash" role="status" aria-label="Loading Kukuta">
      <div className="wordmark-content">
        <div className="splash-emblem" aria-hidden="true">
          <span className="splash-orbit">
            <span />
            <span />
            <span />
          </span>
          <span className="splash-emblem-mark">K</span>
        </div>
        <div className="wordmark-letters" aria-hidden="true">
          {'KUKUTA'.split('').map((letter, index) => (
            <span key={`${letter}-${index}`} style={{ '--letter-index': index }}>{letter}</span>
          ))}
        </div>
        <div className="wordmark-rule" />
        <p>Farm essentials, thoughtfully chosen.</p>
        <div className="splash-loading" aria-hidden="true">
          <span className="splash-loading-track"><span /></span>
          <span className="splash-loading-label">Preparing your farm marketplace</span>
        </div>
      </div>
    </div>
  );
};

export default RoosterSplash;
