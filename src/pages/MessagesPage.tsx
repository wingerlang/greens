import React, { useEffect } from 'react';
import { ConversationList } from '../features/messages/ConversationList.tsx';
import { ChatWindow } from '../features/messages/ChatWindow.tsx';
import { useMessages } from '../context/MessageContext.tsx';

export function MessagesPage() {
    const { activeConversationId, setActiveConversationId } = useMessages();

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
             {/* Desktop: Show both. Mobile: Show list if no active, show chat if active */}
            <div className={`${activeConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full`}>
                <ConversationList />
            </div>

            <div className={`${!activeConversationId ? 'hidden md:flex' : 'flex'} flex-1 h-full relative`}>
                {/* Back button for mobile */}
                {activeConversationId && (
                    <button
                        onClick={() => setActiveConversationId(null)}
                        className="md:hidden absolute top-4 left-4 z-20 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-full shadow-sm border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                        ←
                    </button>
                )}
                <ChatWindow />
            </div>
        </div>
    );
}
