// Renders a single message bubble, styled differently for user vs AI.

'use client';

import ReactMarkdown from 'react-markdown';

export default function ChatMessage({ role, content }) {
  const isUser = role === 'user';

  return (
    <div
      className={`flex w-full ${
        isUser ? 'justify-end' : 'justify-start'
      } mb-2`}
    >
      {!isUser && (
         <div className='w-7 h-7 rounded-full overflow-hidden shrink-0 mt-1 mr-2'>
          <img
            src='/img/chatbotpfp.png'
            alt='PiyuBot'
            className='w-full h-full object-cover'
          />
        </div>
      )}

      <div
        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                    max-w-[80%] break-words
          ${
            isUser
              ? 'bg-blue-900 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }`}
      >
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className='text-lg font-bold mb-2'>
                {children}
              </h1>
            ),

            h2: ({ children }) => (
              <h2 className='text-base font-semibold mb-2'>
                {children}
              </h2>
            ),

            h3: ({ children }) => (
              <h3 className='font-semibold mb-2'>
                {children}
              </h3>
            ),

            p: ({ children }) => (
              <p className='mb-2 last:mb-0'>
                {children}
              </p>
            ),

            ul: ({ children }) => (
              <ul className='list-disc ml-5 mb-2 space-y-1'>
                {children}
              </ul>
            ),

            ol: ({ children }) => (
              <ol className='list-decimal ml-5 mb-2 space-y-1'>
                {children}
              </ol>
            ),

            li: ({ children }) => (
              <li>{children}</li>
            ),

            strong: ({ children }) => (
              <strong className='font-semibold'>
                {children}
              </strong>
            ),

            code: ({ children }) => (
              <code
                className={`px-1 py-0.5 rounded text-xs font-mono ${
                  isUser
                    ? 'bg-blue-800 text-white'
                    : 'bg-gray-200 text-gray-900'
                }`}
              >
                {children}
              </code>
            ),

            a: ({ href, children }) => (
              <a
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                className={`underline ${
                  isUser
                    ? 'text-blue-100'
                    : 'text-blue-700'
                }`}
              >
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}