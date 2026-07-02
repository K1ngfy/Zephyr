import React from 'react';
import ReactMarkdown from 'react-markdown';

interface Props {
  content: string;
  hideThink?: boolean;
}

export const MarkdownRenderer: React.FC<Props> = ({ content, hideThink }) => {
  const parts = content.split(/(<think>[\s\S]*?(?:<\/think>|$))/gi);
  
  return (
    <div className="zephyr-markdown">
      {parts.map((part, index) => {
        if (part.toLowerCase().startsWith('<think>')) {
          if (hideThink) return null;
          const innerText = part.replace(/<think>/i, '').replace(/<\/think>/i, '');
          return (
            <div key={index} className="my-3 px-4 py-3 bg-gray-50/80 border border-gray-200/60 rounded-xl text-[13px] text-gray-500 italic shadow-sm">
              <div className="flex items-center gap-2 mb-1.5 not-italic text-gray-400 font-medium text-[11px] uppercase tracking-wider">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Thinking Process
              </div>
              <div className="leading-relaxed">
                <ReactMarkdown>{innerText}</ReactMarkdown>
              </div>
            </div>
          );
        }
        // Only render ReactMarkdown if there's actual content
        return part ? <ReactMarkdown key={index}>{part}</ReactMarkdown> : null;
      })}
    </div>
  );
};
