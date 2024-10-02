'use client';

import { useState, useEffect } from 'react';
import { SendIcon, MoonIcon, SunIcon, SearchIcon, PlusIcon, UserIcon, LogOutIcon, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

type Message = {
  role: 'user' | 'assistant';
  content: string;
}

type Chat = {
  id: number;
  messages: Message[];
}

type ProcessingStage = 'thinking' | 'model1' | 'model2' | 'model3' | 'ensembling' | null;

export default function MoonDev() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { theme, setTheme } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setProcessingStage('thinking');

    let chatId = currentChatId ?? chats.length + 1;  
    setCurrentChatId(chatId);

    setChats(prevChats => [
      ...prevChats, 
      { id: chatId, messages: [{ role: 'user', content: input }] }
    ]);

    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: input }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() !== '') {
              try {
                const data = JSON.parse(line);
                if (data.stage) {
                  setProcessingStage(data.stage as ProcessingStage);
                  if (data.stage === 'ensembling') {
                    // Add a delay to ensure the ensembling message is visible
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                } else if (data.finalAnswer) {
                  setChats(prevChats => prevChats.map(chat => {
                    if (chat.id === chatId) {
                      return {
                        ...chat,
                        messages: [...chat.messages, { role: 'assistant', content: data.finalAnswer }]
                      }
                    }
                    return chat;
                  }));
                  setProcessingStage(null);
                }
              } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching response:', error);
    } finally {
      setIsLoading(false);
      setProcessingStage(null);
    }
  }

  const handleNewChat = () => {
    setCurrentChatId(null);
    setInput('');
  }

  const handleChatSelect = (chatId: number) => {
    setCurrentChatId(chatId);
  }

  const handleDeleteChat = (chatId: number) => {
    setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    // Clear the current chat if it is deleted
    if (currentChatId === chatId) {
      setCurrentChatId(null);
    }
  }
  

  const handleLogin = () => {
    setIsLoggedIn(true);
  }

  const handleLogout = () => {
    setIsLoggedIn(false);
  }

  const currentChat = chats.find(chat => chat.id === currentChatId);

  const getProcessingMessage = (stage: ProcessingStage) => {
    switch (stage) {
      case 'thinking': return 'Moon.dev is thinking...';
      case 'model1': return 'Getting response from Model 1';
      case 'model2': return 'Getting response from Model 2';
      case 'model3': return 'Getting response from Model 3';
      case 'ensembling': return 'Model Ensembling and processing the final answer';
      default: return '';
    }
  }

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-gray-900' : "bg-[url('/background.jpg')] bg-cover bg-center"}`}>
      <div className="flex w-full h-full">
        {/* Left sidebar with glassmorphism in light mode */}
        <div className={`w-64 flex-shrink-0 border-r p-4 flex flex-col rounded-lg shadow-none 
          ${theme === 'dark' 
          ? 'bg-gray-800 border-gray-700' : 'bg-white/20 backdrop-blur-glass border-[rgba(255,255,255,0.29)]'}`}>
          <CardTitle className="mb-4">Moon.dev</CardTitle>

          <Button onClick={handleNewChat} className="mb-4">
            <PlusIcon className="mr-2 h-4 w-4" />
            New Chat
          </Button>

          <div className="relative mb-4">
            <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search chats"
              className={`pl-8 rounded-lg ${
                theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-[rgba(255,255,255,0.09)] text-black backdrop-blur-glass'
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-grow overflow-auto">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`mb-2 p-2 rounded cursor-pointer ${chat.id === currentChatId ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
                onClick={() => handleChatSelect(chat.id)}
              >
                Chat {chat.id}
              </div>
            ))}
          </div>
        </div>

        {/* Main area */}
        <div className="flex-grow flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className={`flex justify-between items-center p-4 border-b rounded-lg 
            ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white/20 backdrop-blur-glass border-[rgba(255,255,255,0.29)]'}`}>
            <Tabs defaultValue="chat" className="w-full">
              <TabsList>
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="image">Image Generation</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <UserIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48">
                  {isLoggedIn ? (
                    <Button onClick={handleLogout} className="w-full">
                      <LogOutIcon className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  ) : (
                    <Button onClick={handleLogin} className="w-full">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Login
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-grow overflow-hidden p-4">
            <Tabs defaultValue="chat" className="h-full">
              <TabsContent value="chat" className="h-full overflow-hidden">
                <Card className={`h-full flex flex-col rounded-lg 
                  ${theme === 'dark' ? 'bg-gray-800' : 'bg-white/20 backdrop-blur-glass'}`}>
                  <CardHeader>
                    <CardTitle>{currentChat ? `Chat ${currentChatId}` : 'New Chat'}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow overflow-y-auto">
                    {currentChat && currentChat.messages.map((message, index) => (
                      <div key={index} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-block p-2 rounded-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                          <strong>{message.role === 'user' ? 'You' : 'Moon.dev'}:</strong> {message.content}
                        </span>
                      </div>
                    ))}
                    {processingStage && (
                      <div className="flex items-center justify-center text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {getProcessingMessage(processingStage)}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <form onSubmit={handleSubmit} className="w-full space-y-2">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Enter your prompt here..."
                        className="w-full min-h-[80px]"
                      />
                      <Button type="submit" disabled={isLoading} className="w-full">
                        <SendIcon className="w-4 h-4 mr-2" />
                        Send
                      </Button>
                    </form>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}