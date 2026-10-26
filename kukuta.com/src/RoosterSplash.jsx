import React, { useEffect, useState } from 'react';
import './RoosterSplash.css';

const RoosterSplash = ({ onAnimationComplete }) => {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsComplete(true);
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  if (isComplete) {
    return null;
  }

  return (
    <div className="rooster-splash wordmark-splash" role="status" aria-label="Loading Kukuta">
      <div className="wordmark-content">
        <div className="wordmark-letters" aria-hidden="true">
          {'KUKUTA'.split('').map((letter, index) => (
            <span key={`${letter}-${index}`} style={{ '--letter-index': index }}>{letter}</span>
          ))}
        </div>
        <div className="wordmark-rule" />
        <p>Farm essentials, thoughtfully chosen.</p>
      </div>
    </div>
  );
};

export default RoosterSplash;
