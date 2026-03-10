'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// MOCK SOCKET FOR VERCEL SHOWCASE
class MockSocket {
    listeners: Record<string, Function[]> = {};

    on(event: string, fn: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }
    
    off(event: string, fn?: Function) {
        if (!fn) {
            this.listeners[event] = [];
        } else if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(l => l !== fn);
        }
    }
    
    emit() {}
    disconnect() {}

    // Mock trigger
    trigger(event: string, payload: any) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(fn => fn(payload));
        }
    }
}

const globalMockSocket = new MockSocket();

if (typeof window !== 'undefined') {
    (window as any).triggerMockSocket = (event: string, payload: any) => {
        globalMockSocket.trigger(event, payload);
    };
}

interface SocketContextType {
    socket: any;
    connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Simulate immediate connection
        setTimeout(() => {
            setConnected(true);
            globalMockSocket.trigger('connect', null);
            console.log('Mock Socket connected');
        }, 100);
        
        return () => {
            globalMockSocket.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket: globalMockSocket, connected }}>
            {children}
        </SocketContext.Provider>
    );
};
