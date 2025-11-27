'use client';

import React, { memo } from 'react';
import { Bot, User, Send } from 'lucide-react';

interface AIChatSectionProps {
    messages: any[];
    isLoading: boolean;
    input: string;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
}

const AIChatSection = memo(function AIChatSection({
    messages,
    isLoading,
    input,
    onInputChange,
    onSubmit
}: AIChatSectionProps) {
    return (
        <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-[#431412]/10">
            <div className="flex items-center gap-2 mb-4">
                <Bot className="w-6 h-6 text-[#FF5900]" />
                <h3 className="text-lg font-bold text-[#431412]">AI Analyst</h3>
            </div>

            <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {messages.map((m: any) => (
                    <div
                        key={m.id}
                        className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`flex gap-2 max-w-[80%] ${m.role === 'user'
                                    ? 'bg-[#FF5900] text-white'
                                    : 'bg-[#f4ede2] text-[#431412]'
                                } rounded-lg p-3`}
                        >
                            {m.role === 'assistant' && <Bot className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                            <div className="whitespace-pre-wrap text-sm">
                                {m.parts
                                    ? m.parts.map((part: any, i: number) => (
                                        <span key={i}>{part.type === 'text' ? part.text : ''}</span>
                                    ))
                                    : m.content}
                            </div>
                            {m.role === 'user' && <User className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 justify-start">
                        <div className="flex gap-2 bg-[#f4ede2] text-[#431412] rounded-lg p-3">
                            <Bot className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div className="animate-pulse">Analyzing...</div>
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={onSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={onInputChange}
                    placeholder="Ask the agent a question, e.g., &quot;What was Talabat’s spend in the UAE last year?&quot;"
                    className="flex-1 rounded-md border-[#431412]/20 text-sm p-3 border focus:ring-2 focus:ring-[#FF5900]"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-[#FF5900] text-white rounded-md hover:bg-[#E55000] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
});

export default AIChatSection;
