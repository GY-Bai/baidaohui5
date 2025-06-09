'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Badge } from '@kit/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { ScrollArea } from '@kit/ui/scroll-area';
import { Separator } from '@kit/ui/separator';
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical, 
  Hash, 
  Users,
  Settings,
  Search,
  Info,
  Edit,
  Trash2,
  Reply,
  Bot
} from 'lucide-react';
import { 
  supabaseChatAdapter, 
  type ChatMessage, 
  type ChatChannel,
  supabase
} from '../../../lib/supabaseChatAdapter';

interface SupabaseChatInterfaceProps {
  currentUser: {
    id: string;
    name: string;
    email?: string;
    role: string;
    avatar?: string;
  };
}

export function SupabaseChatInterface({ currentUser }: SupabaseChatInterfaceProps) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化聊天
  useEffect(() => {
    initializeChat();
    
    // 设置监听器
    supabaseChatAdapter.onMessage(handleNewMessage);
    supabaseChatAdapter.onChannelUpdate(handleChannelUpdate);
    
    return () => {
      // 清理监听器
      supabaseChatAdapter.removeListener(handleNewMessage);
      supabaseChatAdapter.removeListener(handleChannelUpdate);
    };
  }, []);

  // 滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages, aiMessages]);

  const initializeChat = async () => {
    try {
      const connected = await supabaseChatAdapter.connectUser(currentUser);
      if (connected) {
        setIsConnected(true);
        await loadChannels();
        
        // 自动选择#general频道（如果有权限）
        if (['master', 'firstmate', 'member'].includes(currentUser.role)) {
          const generalChannelId = '00000000-0000-0000-0000-000000000001';
          const generalChannel = await supabaseChatAdapter.getChannel(generalChannelId);
          if (generalChannel) {
            await selectChannel(generalChannel);
          }
        }
      }
    } catch (error) {
      console.error('初始化聊天失败:', error);
    }
  };

  const loadChannels = async () => {
    try {
      const channelList = await supabaseChatAdapter.getChannels();
      setChannels(channelList);
    } catch (error) {
      console.error('加载频道失败:', error);
    }
  };

  const selectChannel = async (channel: ChatChannel) => {
    try {
      setCurrentChannel(channel);
      supabaseChatAdapter.setCurrentChannel(channel);
      
      // 加载消息
      const messageList = await supabaseChatAdapter.getMessages(channel.id);
      setMessages(messageList);
      
      // 标记已读
      if (messageList.length > 0) {
        const lastMessage = messageList[messageList.length - 1];
        if (lastMessage) {
          await supabaseChatAdapter.markRead(channel.id, lastMessage.id);
        }
      }
    } catch (error) {
      console.error('选择频道失败:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentChannel) return;

    // 检查发送权限
    const canSend = supabaseChatAdapter.checkUserPermission(currentUser.role, 'send_message_general');
    if (!canSend && currentChannel.type === 'general') {
      alert('您没有在此频道发送消息的权限');
      return;
    }

    try {
      const message = await supabaseChatAdapter.sendMessage(
        currentChannel.id,
        newMessage.trim(),
        [],
        replyingTo?.id
      );

      if (message) {
        setMessages(prev => [...prev, message]);
        setNewMessage('');
        setReplyingTo(null);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      alert(error instanceof Error ? error.message : '发送消息失败');
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await supabaseChatAdapter.deleteMessage(messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('删除消息失败:', error);
      alert(error instanceof Error ? error.message : '删除消息失败');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentChannel) return;

    try {
      const fileUrl = await supabaseChatAdapter.uploadFile(file, currentChannel.id);
      if (fileUrl) {
        const attachment = {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          url: fileUrl,
          name: file.name,
          size: file.size,
        };

        await supabaseChatAdapter.sendMessage(
          currentChannel.id,
          `分享了文件: ${file.name}`,
          [attachment]
        );
      }
    } catch (error) {
      console.error('文件上传失败:', error);
      alert('文件上传失败');
    }
  };

  const sendAIMessage = async () => {
    if (!aiInput.trim()) return;

    const userMessage = {
      role: 'user' as const,
      content: aiInput.trim(),
      timestamp: new Date(),
    };

    setAiMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setIsAiLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          messages: [
            ...aiMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
            })),
            { role: 'user', content: userMessage.content },
          ],
          model: 'gpt-4o-mini',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI请求失败');
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant' as const,
        content: data.choices?.[0]?.message?.content || '抱歉，AI服务返回了无效响应',
        timestamp: new Date(),
      };

      setAiMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI聊天失败:', error);
      const errorMessage = {
        role: 'assistant' as const,
        content: `抱歉，AI服务暂时不可用: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date(),
      };
      setAiMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const handleNewMessage = (message: ChatMessage & { channel_id?: string }) => {
    if (currentChannel && message.channel_id === currentChannel.id) {
      setMessages(prev => {
        // 避免重复添加消息
        if (prev.find(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
    }
  };

  const handleChannelUpdate = (updatedChannels: ChatChannel[]) => {
    setChannels(updatedChannels);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUserRoleBadge = (role: string) => {
    const roleConfig = {
      master: { label: 'Master', color: 'bg-purple-500' },
      firstmate: { label: 'Firstmate', color: 'bg-blue-500' },
      member: { label: 'Member', color: 'bg-green-500' },
      seller: { label: 'Seller', color: 'bg-orange-500' },
      fan: { label: 'Fan', color: 'bg-gray-500' },
    };

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.fan;
    return (
      <Badge className={`${config.color} text-white text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const renderMessage = (message: ChatMessage) => {
    const isOwnMessage = message.user.id === currentUser.id;
    const canDelete = isOwnMessage || ['master', 'firstmate'].includes(currentUser.role);

    return (
      <div key={message.id} className={`flex gap-3 p-3 hover:bg-gray-50 ${isOwnMessage ? 'bg-blue-50' : ''}`}>
        <Avatar className="w-8 h-8">
          <AvatarImage src={message.user.avatar_url} />
          <AvatarFallback>{message.user.full_name.charAt(0)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{message.user.full_name}</span>
            {getUserRoleBadge(message.user.role)}
            <span className="text-xs text-gray-500">{formatTime(message.created_at)}</span>
            
            {canDelete && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReplyingTo(message)}
                  className="h-6 w-6 p-0"
                >
                  <Reply className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMessage(message.id)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          
          {message.reply_to && (
            <div className="bg-gray-100 border-l-2 border-gray-300 pl-2 py-1 mb-2 text-sm">
              <span className="text-gray-600">回复 {message.reply_to.user.full_name}:</span>
              <div className="text-gray-800">{message.reply_to.content}</div>
            </div>
          )}
          
          <div className="text-sm text-gray-900 break-words">
            {message.content}
          </div>
          
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment, index) => (
                <div key={index} className="border rounded p-2">
                  {attachment.type === 'image' ? (
                    <img 
                      src={attachment.url} 
                      alt={attachment.name}
                      className="max-w-xs max-h-48 rounded"
                    />
                  ) : (
                    <a 
                      href={attachment.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      📎 {attachment.name}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAIMessage = (message: { role: 'user' | 'assistant'; content: string; timestamp: Date }, index: number) => {
    const isUser = message.role === 'user';
    
    return (
      <div key={index} className={`flex gap-3 p-3 ${isUser ? 'bg-blue-50' : 'bg-gray-50'}`}>
        <Avatar className="w-8 h-8">
          {isUser ? (
            <>
              <AvatarImage src={currentUser.avatar} />
              <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
            </>
          ) : (
            <AvatarFallback className="bg-purple-500 text-white">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          )}
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
              {isUser ? currentUser.name : 'AI助手'}
            </span>
            {isUser && getUserRoleBadge(currentUser.role)}
            <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
          </div>
          
          <div className="text-sm text-gray-900 break-words whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <Card className="w-full h-96">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500">正在连接聊天服务...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-96 border rounded-lg overflow-hidden">
      {/* 左侧频道列表 */}
      <div className="w-64 bg-gray-50 border-r">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">聊天频道</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAIChat(!showAIChat)}
              className={`h-8 w-8 p-0 ${showAIChat ? 'bg-purple-100 text-purple-600' : ''}`}
            >
              <Bot className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <ScrollArea className="h-full">
          <div className="p-2 space-y-1">
            {channels.map((channel) => (
              <Button
                key={channel.id}
                variant={currentChannel?.id === channel.id ? 'secondary' : 'ghost'}
                className="w-full justify-start h-auto p-2"
                onClick={() => selectChannel(channel)}
              >
                <div className="flex items-center gap-2 w-full">
                  <Hash className="h-4 w-4" />
                  <span className="flex-1 text-left">{channel.name}</span>
                  {channel.unread_count > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {channel.unread_count}
                    </Badge>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧聊天区域 */}
      <div className="flex-1 flex flex-col">
        {showAIChat ? (
          // AI聊天界面
          <>
            <div className="p-4 border-b bg-purple-50">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-purple-800">AI助手</h3>
                {currentUser.role === 'fan' && (
                  <Badge variant="secondary" className="text-xs">
                    Fan用户无法使用
                  </Badge>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {aiMessages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>开始与AI助手对话吧！</p>
                  </div>
                )}
                
                {aiMessages.map((message, index) => renderAIMessage(message, index))}
                
                {isAiLoading && (
                  <div className="flex gap-3 p-3 bg-gray-50">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-purple-500 text-white">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">AI助手</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="animate-bounce w-2 h-2 bg-gray-400 rounded-full"></div>
                        <div className="animate-bounce w-2 h-2 bg-gray-400 rounded-full" style={{ animationDelay: '0.1s' }}></div>
                        <div className="animate-bounce w-2 h-2 bg-gray-400 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </ScrollArea>

            <div className="p-4 border-t">
              {currentUser.role === 'fan' ? (
                <div className="text-center text-gray-500 py-4">
                  <p>Fan用户无法使用AI助手功能</p>
                  <p className="text-sm">升级为Member以解锁AI聊天</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="向AI助手提问..."
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendAIMessage()}
                    disabled={isAiLoading}
                  />
                  <Button 
                    onClick={sendAIMessage} 
                    disabled={!aiInput.trim() || isAiLoading}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          // 普通聊天界面
          <>
            {currentChannel ? (
              <>
                <div className="p-4 border-b">
                  <div className="flex items-center gap-2">
                    <Hash className="h-5 w-5" />
                    <h3 className="font-semibold">{currentChannel.name}</h3>
                    {currentChannel.description && (
                      <span className="text-sm text-gray-500">- {currentChannel.description}</span>
                    )}
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="divide-y">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <Hash className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>还没有消息，开始聊天吧！</p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div key={message.id} className="group">
                          {renderMessage(message)}
                        </div>
                      ))
                    )}
                  </div>
                  <div ref={messagesEndRef} />
                </ScrollArea>

                <div className="p-4 border-t">
                  {replyingTo && (
                    <div className="mb-2 p-2 bg-gray-100 rounded text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">回复 {replyingTo.user.full_name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReplyingTo(null)}
                          className="h-6 w-6 p-0"
                        >
                          ×
                        </Button>
                      </div>
                      <div className="text-gray-800 truncate">{replyingTo.content}</div>
                    </div>
                  )}
                  
                  {supabaseChatAdapter.checkUserPermission(currentUser.role, 'send_message_general') || currentChannel.type !== 'general' ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-10 w-10 p-0"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="输入消息..."
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      />
                      <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept="image/*,.pdf,.doc,.docx,.txt"
                      />
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      <p>您没有在此频道发送消息的权限</p>
                      {currentUser.role === 'fan' && (
                        <p className="text-sm">Fan用户无法发送消息</p>
                      )}
                      {currentUser.role === 'member' && currentChannel.type === 'general' && (
                        <p className="text-sm">Member只能在私聊中发送消息</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Hash className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>选择一个频道开始聊天</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 