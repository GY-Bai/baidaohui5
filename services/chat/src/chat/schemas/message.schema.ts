export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  metadata?: {
    file_url?: string;
    file_name?: string;
    file_size?: number;
    thumbnail_url?: string;
    image_width?: number;
    image_height?: number;
  };
  reply_to?: string;
  is_deleted: boolean;
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Channel {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'general';
  participants: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: Date;
}

export interface ReadReceipt {
  id: string;
  message_id: string;
  user_id: string;
  read_at: Date;
} 