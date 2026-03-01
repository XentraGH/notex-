'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { toast } from '@/hooks/use-toast';

// Types
interface User {
  id: string;
  name: string;
  username: string;
  profilePicture: string | null;
  defaultNoteName: string;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  isLocked: boolean;
  password: string | null;
  createdAt: string;
  updatedAt: string;
  authorId: string;
}

interface Notification {
  id: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    username: string;
    profilePicture: string | null;
  };
  note: {
    id: string;
    title: string;
    content: string;
  };
  createdAt: string;
}

interface AdminUser {
  id: string;
  name: string;
  username: string;
  password: string;
  profilePicture: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
  _count: {
    notes: number;
  };
}

// App States
type AppState = 'loading' | 'welcome' | 'login' | 'signup' | 'dashboard';

export default function NoteXApp() {
  // State
  const [appState, setAppState] = useState<AppState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isNoteUnlocked, setIsNoteUnlocked] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchUsers, setSearchUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [showGuestPopup, setShowGuestPopup] = useState(false);
  const [showGuestLimitPopup, setShowGuestLimitPopup] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropTarget, setCropTarget] = useState<'signup' | 'settings'>('signup');
  const [cropImage, setCropImage] = useState<string>('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({ name: '', username: '', password: '', profilePicture: '' });
  
  const [settingsForm, setSettingsForm] = useState({ name: '', username: '', profilePicture: '', defaultNoteName: 'Untitled Note', newPassword: '' });
  const [lockPassword, setLockPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');

  // Refs
  const noteTitleRef = useRef<HTMLInputElement>(null);
  const noteContentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const adminRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropZoomRef = useRef(1);
  const cropPositionRef = useRef({ x: 0, y: 0 });

  // Auto-refresh interval (30 seconds)
  const REFRESH_INTERVAL = 30000;

  // Fetch notes
  const fetchNotes = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/notes?authorId=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setNotes(data.notes);
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  // Check for existing session on mount - using lazy initialization pattern
  useEffect(() => {
    // Seed admin account
    fetch('/api/seed').catch(() => {});
    
    // Defer state updates to avoid cascading renders
    queueMicrotask(() => {
      const savedUser = localStorage.getItem('notex_user');
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          setAppState('dashboard');
        } catch {
          localStorage.removeItem('notex_user');
          setAppState('welcome');
        }
      } else {
        setAppState('welcome');
      }
      setIsLoading(false);
    });
  }, []);

  // Fetch notes when user logs in - defer with microtask
  useEffect(() => {
    if (user && appState === 'dashboard') {
      queueMicrotask(() => {
        fetchNotes(user.id);
        fetchNotifications(user.id);
      });
    }

  }, [user, appState]);

  // Auto-refresh: Notes and Notifications
  useEffect(() => {
    if (!user || appState !== 'dashboard' || isGuestMode) return;

    refreshIntervalRef.current = setInterval(() => {
      if (navigator.onLine) {
        fetchNotes(user.id);
        fetchNotifications(user.id);
      }
    }, REFRESH_INTERVAL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [user, appState, isGuestMode, fetchNotes, fetchNotifications]);

  // Auto-save note
  const autoSaveNote = useCallback(async (noteId: string, title: string, content: string) => {
    // Skip API call for guest notes
    if (noteId.startsWith('guest-')) return;
    try {
      await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, []);

  const debouncedSave = useCallback((noteId: string, title: string, content: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      autoSaveNote(noteId, title, content);
    }, 500);
  }, [autoSaveNote]);

  // Handle note title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedNote) return;
    const newTitle = e.target.value;
    const updatedNote = { ...selectedNote, title: newTitle };
    setSelectedNote(updatedNote);
    setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
    debouncedSave(selectedNote.id, newTitle, selectedNote.content);
  };

  // Handle note content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!selectedNote) return;
    let newContent = e.target.value;
    
    // Limit guests to 4500 characters
    if (isGuestMode && newContent.length > 4500) {
      newContent = newContent.substring(0, 4500);
      toast({ title: 'Limit reached', description: 'Guests can only write 4500 characters per note', variant: 'destructive' });
    }
    
    const updatedNote = { ...selectedNote, content: newContent };
    setSelectedNote(updatedNote);
    setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
    debouncedSave(selectedNote.id, selectedNote.title, newContent);
  };

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem('notex_user', JSON.stringify(data.user));
        setAppState('dashboard');
        setLoginForm({ username: '', password: '' });
        toast({ title: 'Welcome back!', description: `Logged in as ${data.user.name}`, variant: 'success' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to login', variant: 'destructive' });
    }
  };

  // Signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupForm.password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupForm),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem('notex_user', JSON.stringify(data.user));
        setAppState('dashboard');
        setSignupForm({ name: '', username: '', password: '', profilePicture: '' });
        toast({ title: 'Welcome!', description: 'Account created successfully', variant: 'success' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create account', variant: 'destructive' });
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('notex_user');
    setUser(null);
    setNotes([]);
    setSelectedNote(null);
    setNotifications([]);
    setShowAdminPanel(false);
    setIsGuestMode(false);
    setAppState('welcome');
    toast({ title: 'Goodbye!', description: 'You have been logged out', variant: 'success' });
  };

  // Create new note
  const createNote = async () => {
    // Guest mode - create local note (max 7 notes)
    if (isGuestMode) {
      if (notes.length >= 7) {
        toast({ title: 'Limit reached', description: 'Guests can only create 7 notes. Sign up for more!', variant: 'destructive' });
        return;
      }
      const guestNote: Note = {
        id: `guest-${Date.now()}`,
        title: 'Untitled Note',
        content: '',
        isLocked: false,
        password: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorId: 'guest',
      };
      setNotes([guestNote, ...notes]);
      setSelectedNote(guestNote);
      setIsNoteUnlocked(true);
      setShowAdminPanel(false);
      toast({ title: 'Note created', description: 'Start typing your note', variant: 'success' });
      return;
    }

    if (!user) return;
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotes([data.note, ...notes]);
        setSelectedNote(data.note);
        setIsNoteUnlocked(true);
        setShowAdminPanel(false);
        toast({ title: 'Note created', description: 'Start typing your note', variant: 'success' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create note', variant: 'destructive' });
    }
  };

  // Delete note
  const deleteNote = async () => {
    if (!selectedNote) return;

    // Guest mode - delete locally
    if (selectedNote.id.startsWith('guest-')) {
      setNotes(notes.filter(n => n.id !== selectedNote.id));
      setSelectedNote(null);
      setIsNoteUnlocked(false);
      setShowDeleteConfirm(false);
      toast({ title: 'Note deleted', variant: 'success' });
      return;
    }

    try {
      const res = await fetch(`/api/notes/${selectedNote.id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotes(notes.filter(n => n.id !== selectedNote.id));
        setSelectedNote(null);
        setIsNoteUnlocked(false);
        setShowDeleteConfirm(false);
        toast({ title: 'Note deleted', variant: 'success' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete note', variant: 'destructive' });
    }
  };

  // Copy note
  const copyNote = async () => {
    if (!selectedNote) return;
    const plainText = selectedNote.content.replace(/<[^>]*>/g, '');
    await navigator.clipboard.writeText(plainText);
    toast({ title: 'Copied!', description: 'Note content copied to clipboard', variant: 'success' });
  };

  // Export note
  const exportNote = async () => {
    if (!selectedNote) return;
    const plainText = selectedNote.content.replace(/<[^>]*>/g, '');
    const defaultFilename = selectedNote.title + '.txt';

    try {
      // Check if File System Access API is supported
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        const showSaveFilePicker = (window as Window & { showSaveFilePicker?: (options: unknown) => Promise<unknown> }).showSaveFilePicker;
        
        if (showSaveFilePicker) {
          const handle = await showSaveFilePicker({
            suggestedName: defaultFilename,
            types: [
              {
                description: 'Text Files',
                accept: { 'text/plain': ['.txt'] }
              }
            ]
          });
          
          const writable = await (handle as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
          await writable.write(plainText);
          await writable.close();
          toast({ title: 'Note exported!', variant: 'success' });
          return;
        }
      }
      
      // Fallback for browsers without File System Access API
      const blob = new Blob([plainText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Note exported!', variant: 'success' });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        // User cancelled the save dialog - don't show error
        return;
      }
      console.error('Export error:', err);
      toast({ title: 'Error', description: 'Export failed. Please try again.', variant: 'destructive' });
    }
  };

  // Lock note
  const lockNote = async () => {
    if (!selectedNote || !lockPassword) return;
    try {
      const res = await fetch(`/api/notes/${selectedNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: true, password: lockPassword }),
      });
      if (res.ok) {
        const updatedNote = { ...selectedNote, isLocked: true };
        setSelectedNote(updatedNote);
        setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
        setShowLockModal(false);
        setLockPassword('');
        toast({ title: 'Note locked', description: 'Password protection enabled', variant: 'success' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to lock note', variant: 'destructive' });
    }
  };

  // Unlock note
  const unlockNoteRequest = async () => {
    if (!selectedNote) return;
    try {
      const res = await fetch(`/api/notes/${selectedNote.id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: unlockPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsNoteUnlocked(true);
        setShowUnlockModal(false);
        setUnlockPassword('');
        toast({ title: 'Note unlocked', variant: 'success' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to unlock note', variant: 'destructive' });
    }
  };

  // Remove lock
  const removeLock = async () => {
    if (!selectedNote) return;
    try {
      const res = await fetch(`/api/notes/${selectedNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: false }),
      });
      if (res.ok) {
        const updatedNote = { ...selectedNote, isLocked: false, password: null };
        setSelectedNote(updatedNote);
        setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
        toast({ title: 'Lock removed', variant: 'success' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove lock', variant: 'destructive' });
    }
  };

  // Search users for sharing
  const searchForUsers = async (query: string) => {
    if (!user || query.length < 1) {
      setSearchUsers([]);
      return;
    }
    try {
      const res = await fetch(`/api/search/users?q=${encodeURIComponent(query)}&currentUserId=${user.id}`);
      const data = await res.json();
      if (res.ok) {
        setSearchUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  // Share note
  const shareNote = async (receiverId: string) => {
    if (!selectedNote || !user) return;
    try {
      const res = await fetch(`/api/notes/${selectedNote.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId, senderId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowShareModal(false);
        setSearchQuery('');
        setSearchUsers([]);
        toast({ title: 'Note shared', description: 'The user will receive a notification', variant: 'success' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to share note', variant: 'destructive' });
    }
  };

  // Handle notification action
  const handleNotificationAction = async (notificationId: string, action: 'accept' | 'reject') => {
    if (!user) return;
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId: user.id }),
      });
      if (res.ok) {
        setNotifications(notifications.filter(n => n.id !== notificationId));
        if (action === 'accept' && user) {
          fetchNotes(user.id);
          toast({ title: 'Note accepted', description: 'The note has been added to your notes', variant: 'success' });
        } else {
          toast({ title: 'Note declined', variant: 'success' });
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to process notification', variant: 'destructive' });
    }
  };

  // Update settings
  const updateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await fetch(`/api/user/settings/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem('notex_user', JSON.stringify(data.user));
        setShowSettings(false);
        toast({ title: 'Settings saved', variant: 'success' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update settings', variant: 'destructive' });
    }
  };

  // Delete account
  const deleteAccount = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/user/delete/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        localStorage.removeItem('notex_user');
        setUser(null);
        setNotes([]);
        setSelectedNote(null);
        setNotifications([]);
        setShowSettings(false);
        setShowDeleteConfirm(false);
        setAppState('welcome');
        toast({ title: 'Account deleted', variant: 'success' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete account', variant: 'destructive' });
    }
  };

  // Fetch admin users
  const fetchAdminUsers = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/admin/users?adminId=${user.id}`);
      const data = await res.json();
      if (res.ok) {
        setAdminUsers(data.users);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to fetch admin users:', error);
    }
  };

  // Ban/unban user
  const toggleBan = async (userId: string, ban: boolean) => {
    if (!user) return;
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ban, adminId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchAdminUsers();
        toast({ title: ban ? 'User banned' : 'User unbanned', variant: 'success' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update user', variant: 'destructive' });
    }
  };

  // Copy all user data
  const copyAllUserData = async () => {
    const dataStr = JSON.stringify(adminUsers, null, 2);
    await navigator.clipboard.writeText(dataStr);
    toast({ title: 'Copied!', description: 'All user data copied to clipboard', variant: 'success' });
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'signup' | 'settings') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Open crop modal
        setCropImage(base64);
        setCropTarget(target);
        setCropZoom(1);
        setCropPosition({ x: 0, y: 0 });
        // Update refs for applyCrop
        cropZoomRef.current = 1;
        cropPositionRef.current = { x: 0, y: 0 };
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle crop mouse events
  const handleCropMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropPosition.x, y: e.clientY - cropPosition.y });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setCropPosition({ x: newX, y: newY });
    cropPositionRef.current = { x: newX, y: newY };
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
  };

  // Apply crop and save
  const applyCrop = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const outputSize = 200;
    canvas.width = outputSize;
    canvas.height = outputSize;

    const img = new Image();
    img.onload = () => {
      // Get current values from refs
      const zoom = cropZoomRef.current;
      const pos = cropPositionRef.current;

      // The preview shows: scale(zoom) translate(pos.x/zoom, pos.y/zoom)
      // on a 256x256 circle with bg-cover bg-center
      
      const previewSize = 256;
      
      // Calculate the natural "cover" size of the image in the preview
      const imgRatio = img.width / img.height;
      let coverWidth, coverHeight;
      
      if (imgRatio >= 1) {
        // Landscape: height matches preview, width is larger
        coverHeight = previewSize;
        coverWidth = previewSize * imgRatio;
      } else {
        // Portrait: width matches preview, height is larger
        coverWidth = previewSize;
        coverHeight = previewSize / imgRatio;
      }

      // The scale transform multiplies the size
      const scaledWidth = coverWidth * zoom;
      const scaledHeight = coverHeight * zoom;

      // The translate is applied after scale, so actual offset is:
      // translate amount * scale = pos.x * zoom
      const actualOffsetX = pos.x;
      const actualOffsetY = pos.y;

      // Center position of scaled image in preview
      const centerX = (previewSize - scaledWidth) / 2 + actualOffsetX;
      const centerY = (previewSize - scaledHeight) / 2 + actualOffsetY;

      // The crop circle is centered at (128, 128) with radius 100
      // We want to grab a 200x200 square centered at (128, 128)
      // And map it back to the original image coordinates
      
      // Position in the scaled image space where crop starts
      const cropCenterX = 128;
      const cropCenterY = 128;
      
      // Convert to original image coordinates
      const scaleX = img.width / scaledWidth;
      const scaleY = img.height / scaledHeight;
      
      // Top-left of the 200x200 crop area in preview space
      const cropLeft = 28;
      const cropTop = 28;
      
      // Top-left in scaled image space
      const scaledCropLeft = cropLeft - centerX;
      const scaledCropTop = cropTop - centerY;
      
      // Convert to original image pixels
      const sourceX = scaledCropLeft * scaleX;
      const sourceY = scaledCropTop * scaleY;
      const sourceSize = 200 * scaleX;

      // Draw to canvas
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        outputSize,
        outputSize
      );

      const croppedBase64 = canvas.toDataURL('image/png');
      
      if (cropTarget === 'signup') {
        setSignupForm({ ...signupForm, profilePicture: croppedBase64 });
      } else {
        setSettingsForm({ ...settingsForm, profilePicture: croppedBase64 });
      }
      
      setShowCropModal(false);
      setCropImage('');
      toast({ title: 'Profile picture updated!', variant: 'success' });
    };
    img.onerror = () => {
      toast({ title: 'Error', description: 'Failed to process image', variant: 'destructive' });
    };
    img.src = cropImage;
  };

  // Select note
  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setIsNoteUnlocked(false);
    setShowAdminPanel(false);
    if (note.isLocked) {
      setShowUnlockModal(true);
    } else {
      setIsNoteUnlocked(true);
    }
  };

  // Filter notes by search
  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Open settings
  const openSettings = () => {
    if (user) {
      setSettingsForm({
        name: user.name,
        username: user.username,
        profilePicture: user.profilePicture || '',
        defaultNoteName: user.defaultNoteName,
        newPassword: '',
      });
    }
    setShowSettings(true);
  };

  // Effect for admin panel
  useEffect(() => {
    if (showAdminPanel && user?.isAdmin) {
      queueMicrotask(() => {
        fetchAdminUsers();
      });
      
      // Auto-refresh admin users every 30 seconds
      adminRefreshIntervalRef.current = setInterval(() => {
        if (navigator.onLine) {
          fetchAdminUsers();
        }
      }, REFRESH_INTERVAL);
    } else {
      // Clear interval when admin panel is closed
      if (adminRefreshIntervalRef.current) {
        clearInterval(adminRefreshIntervalRef.current);
        adminRefreshIntervalRef.current = null;
      }
    }

    return () => {
      if (adminRefreshIntervalRef.current) {
        clearInterval(adminRefreshIntervalRef.current);
      }
    };
  }, [showAdminPanel, user]);

  // Loading state - Welcome screen
  if (appState === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center">
            <Image src="/notex-icon.png" alt="NoteX" width={100} height={100} className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Welcome to NoteX!</h1>
          <p className="text-slate-500 mb-6">Your simple note taking app</p>
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-600"></div>
            <span className="text-slate-400">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Welcome Page
  if (appState === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center">
            <Image src="/notex-icon.png" alt="NoteX" width={100} height={100} className="object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">NoteX</h1>
          <p className="text-slate-500 mb-6">Your simple note taker</p>
          
          <div className="text-left space-y-3 mb-6">
            <div className="flex items-center gap-3 text-slate-600">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Create and edit rich text notes</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Lock notes with password</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export and copy notes</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Share notes with users</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-left">
            <p className="text-blue-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              You can only run this app when you are connected to the internet.
            </p>
          </div>

          <button
            onClick={() => setAppState('signup')}
            className="w-full bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 transition-colors cursor-pointer mb-3"
          >
            Get Started
          </button>
          <button
            onClick={() => setAppState('login')}
            className="w-full border border-slate-300 text-slate-600 py-3 rounded-lg font-semibold hover:bg-slate-50 transition-colors cursor-pointer mb-3"
          >
            I already have an account
          </button>
          <button
            onClick={() => {
              setIsGuestMode(true);
              setAppState('dashboard');
              setTimeout(() => setShowGuestPopup(true), 500);
            }}
            className="w-full text-slate-500 py-2 text-sm hover:text-violet-600 transition-colors cursor-pointer"
          >
            Try without an account
          </button>
        </div>
      </div>
    );
  }

  // Login Page
  if (appState === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-3 rounded-2xl flex items-center justify-center">
              <Image src="/notex-icon.png" alt="NoteX" width={80} height={80} className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
            <p className="text-slate-500">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text"
                dir="ltr"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                dir="ltr"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 text-center text-slate-500 text-sm">
            Don&apos;t have an account?{' '}
            <button onClick={() => setAppState('signup')} className="text-violet-600 hover:underline cursor-pointer">
              Sign up
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Signup Page
  if (appState === 'signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-3 rounded-2xl flex items-center justify-center">
              <Image src="/notex-icon.png" alt="NoteX" width={80} height={80} className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Create Account</h1>
            <p className="text-slate-500">Join NoteX today</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="flex justify-center mb-4">
              <label className="cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden hover:border-violet-500 transition-colors">
                  {signupForm.profilePicture ? (
                    <img src={signupForm.profilePicture} alt="Profile" className="object-contain" />
                  ) : (
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleProfilePictureUpload(e, 'signup')}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                dir="ltr"
                value={signupForm.name}
                onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="Your name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text"
                dir="ltr"
                value={signupForm.username}
                onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="Choose a username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                dir="ltr"
                value={signupForm.password}
                onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="Min. 6 characters"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 transition-colors cursor-pointer"
            >
              Create Account
            </button>
          </form>

          <div className="mt-6 text-center text-slate-500 text-sm">
            Already have an account?{' '}
            <button onClick={() => setAppState('login')} className="text-violet-600 hover:underline cursor-pointer">
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar */}
      <div className="w-[270px] bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0">
        {/* Logo */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center">
              <Image src="/notex-icon.png" alt="NoteX" width={48} height={48} className="object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">NoteX</h1>
              <p className="text-xs text-slate-500">Simple note taker</p>
            </div>
          </div>
        </div>

        {/* Admin Button */}
        {user?.isAdmin && (
          <div className="px-4 pt-4">
            <button
              onClick={() => {
                setShowAdminPanel(!showAdminPanel);
                setSelectedNote(null);
              }}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                showAdminPanel
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {showAdminPanel ? 'Back to Notes' : 'Admin Panel'}
            </button>
          </div>
        )}

        {/* New Note Button */}
        {!showAdminPanel && (
          <div className="px-4 pt-4">
            <button
              onClick={createNote}
              className="w-full bg-violet-600 text-white py-2.5 rounded-lg font-semibold hover:bg-violet-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Note
            </button>
          </div>
        )}

        {/* Search */}
        {!showAdminPanel && (
          <div className="px-4 pt-4">
            <div className="relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                dir="ltr"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Notes List */}
        {!showAdminPanel && (
          <div className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="px-4 flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Notes</span>
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{notes.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 space-y-1">
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    selectedNote?.id === note.id
                      ? 'bg-violet-50 border border-violet-200'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {note.isLocked && (
                      <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                    <span className="font-medium text-slate-800 truncate flex-1">{note.title}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
              {filteredNotes.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No notes yet</p>
              )}
            </div>
          </div>
        )}

        {/* Admin Panel Content */}
        {showAdminPanel && (
          <div className="flex-1 overflow-hidden flex flex-col mt-4 px-4">
            <p className="text-sm text-slate-600 mb-2">Manage users and their permissions</p>
            <div className="text-xs text-slate-500">
              Total users: {adminUsers.length}
            </div>
          </div>
        )}

        {/* User Profile */}
        <div className="border-t border-slate-200 p-4">
          {isGuestMode ? (
            // Guest Profile
            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-violet-100 mx-auto mb-2 flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">Guest Mode</p>
              <p className="text-xs text-slate-400 mb-3">{notes.length}/7 notes</p>
              <button
                onClick={() => {
                  setIsGuestMode(false);
                  setAppState('signup');
                }}
                className="w-full bg-violet-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors cursor-pointer"
              >
                Sign Up
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-slate-500 py-2 text-xs hover:text-slate-700 mt-2 cursor-pointer"
              >
                Exit Guest Mode
              </button>
            </div>
          ) : (
            // Regular User Profile
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt="Profile" className="object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">@{user?.username}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={openSettings}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowNotifications(true)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer relative"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-[270px] flex-1 h-screen overflow-hidden">
        {showAdminPanel ? (
          // Admin Panel
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Admin Panel</h2>
              <button
                onClick={copyAllUserData}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer text-sm font-medium"
              >
                Copy All User Data
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Profile</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Name</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Username</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Password</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Notes</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Status</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {adminUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden">
                            {u.profilePicture ? (
                              <img src={u.profilePicture} alt="" className="object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">@{u.username}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400 font-mono truncate max-w-[120px]">
                              {u.password.substring(0, 15)}...
                            </span>
                            <button
                              onClick={async () => {
                                await navigator.clipboard.writeText(u.password);
                                toast({ title: 'Copied!', description: 'Password copied to clipboard', variant: 'success' });
                              }}
                              className="p-1 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors cursor-pointer"
                              title="Copy password"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLine-linejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{u._count.notes}</td>
                        <td className="px-4 py-3">
                          {u.isAdmin ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                              Admin
                            </span>
                          ) : u.isBanned ? (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                              Banned
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!u.isAdmin && (
                            <button
                              onClick={() => toggleBan(u.id, !u.isBanned)}
                              className={`px-3 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                                u.isBanned
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                              }`}
                            >
                              {u.isBanned ? 'Unban' : 'Ban'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : selectedNote ? (
          // Note Editor
          <div className="h-full flex flex-col bg-white">
            {/* Title Bar */}
            <div className="p-4 border-b border-slate-200 flex items-center gap-4">
              <input
                ref={noteTitleRef}
                type="text"
                dir="ltr"
                value={selectedNote.title}
                onChange={handleTitleChange}
                className="flex-1 text-xl font-semibold text-slate-800 focus:outline-none bg-transparent"
                placeholder="Note title"
                disabled={!isNoteUnlocked}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={copyNote}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Copy"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={exportNote}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Export"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (isGuestMode) {
                      setShowGuestLimitPopup(true);
                      return;
                    }
                    if (selectedNote.isLocked) {
                      removeLock();
                    } else {
                      setShowLockModal(true);
                    }
                  }}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    selectedNote.isLocked
                      ? 'text-amber-500 hover:bg-amber-50'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                  title={selectedNote.isLocked ? 'Unlock' : 'Lock'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {selectedNote.isLocked ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    )}
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (isGuestMode) {
                      setShowGuestLimitPopup(true);
                      return;
                    }
                    setShowShareModal(true);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Share"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Note Content */}
            <div className="flex-1 p-4">
              {isNoteUnlocked ? (
                <textarea
                  ref={noteContentRef}
                  dir="ltr"
                  value={selectedNote.content}
                  onChange={handleContentChange}
                  className="w-full h-full resize-none focus:outline-none text-slate-700 leading-relaxed"
                  placeholder="Start typing your note..."
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-slate-500 mb-2">This note is locked</p>
                    <button
                      onClick={() => setShowUnlockModal(true)}
                      className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors cursor-pointer"
                    >
                      Unlock
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Empty State
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg className="w-20 h-20 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-xl font-semibold text-slate-600 mb-2">No Note Selected</h2>
              <p className="text-slate-400 mb-4">Select a note from the sidebar or create a new one</p>
              <button
                onClick={createNote}
                className="px-6 py-3 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-700 transition-colors cursor-pointer"
              >
                Create New Note
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={() => setShowNotifications(false)} />
          <div className="relative bg-white w-96 h-full shadow-xl overflow-auto animate-slide-in-right">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-semibold text-slate-800">Notifications</h3>
              <button
                onClick={() => setShowNotifications(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              {notifications.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No notifications</p>
              ) : (
                notifications.map((notification) => (
                  <div key={notification.id} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0">
                        {notification.sender.profilePicture ? (
                          <img src={notification.sender.profilePicture} alt="" className="object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">@{notification.sender.username}</p>
                        <p className="text-xs text-slate-500">shared a note with you</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-3 font-medium">{notification.note.title}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleNotificationAction(notification.id, 'accept')}
                        className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleNotificationAction(notification.id, 'reject')}
                        className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={() => setShowSettings(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-auto animate-scale-in">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-slate-800">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={updateSettings} className="p-6 space-y-4">
              <div className="flex justify-center">
                <label className="cursor-pointer relative">
                  <div className="w-24 h-24 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden hover:border-violet-500 transition-colors">
                    {settingsForm.profilePicture ? (
                      <img src={settingsForm.profilePicture} alt="Profile" className="object-contain" />
                    ) : (
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProfilePictureUpload(e, 'settings')}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  dir="ltr"
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  dir="ltr"
                  value={settingsForm.username}
                  onChange={(e) => setSettingsForm({ ...settingsForm, username: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Note Name</label>
                <input
                  type="text"
                  dir="ltr"
                  value={settingsForm.defaultNoteName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, defaultNoteName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <details className="group">
                <summary className="cursor-pointer list-none flex items-center justify-between py-2 text-sm font-medium text-slate-700 hover:text-violet-600">
                  Change Password
                  <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="pt-3">
                  <input
                    type="password"
                    dir="ltr"
                    value={settingsForm.newPassword}
                    onChange={(e) => setSettingsForm({ ...settingsForm, newPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="New password (min 6 chars)"
                  />
                </div>
              </details>

              <button
                type="submit"
                className="w-full bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 transition-colors cursor-pointer"
              >
                Save Settings
              </button>

              {!user?.isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full bg-red-50 text-red-600 py-3 rounded-lg font-semibold hover:bg-red-100 transition-colors cursor-pointer"
                >
                  Delete Account
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={() => {
            setShowShareModal(false);
            setSearchQuery('');
            setSearchUsers([]);
          }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-scale-in">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Share Note</h3>
            </div>
            <div className="p-6">
              <input
                type="text"
                dir="ltr"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchForUsers(e.target.value);
                }}
                placeholder="Search users by username..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="mt-4 space-y-2 max-h-60 overflow-auto">
                {searchUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => shareNote(u.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                      {u.profilePicture ? (
                        <img src={u.profilePicture} alt="" className="object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{u.name}</p>
                      <p className="text-sm text-slate-500">@{u.username}</p>
                    </div>
                  </button>
                ))}
                {searchQuery && searchUsers.length === 0 && (
                  <p className="text-center text-slate-400 py-4">No users found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lock Modal */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={() => {
            setShowLockModal(false);
            setLockPassword('');
          }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 animate-scale-in">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Lock Note</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500">Enter a password to lock this note. You&apos;ll need this password to access the note later.</p>
              <input
                type="password"
                dir="ltr"
                value={lockPassword}
                onChange={(e) => setLockPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowLockModal(false);
                    setLockPassword('');
                  }}
                  className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={lockNote}
                  className="flex-1 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors cursor-pointer"
                >
                  Lock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={() => {
            setShowUnlockModal(false);
            setUnlockPassword('');
          }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 animate-scale-in">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Unlock Note</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500">Enter the password to unlock this note.</p>
              <input
                type="password"
                dir="ltr"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowUnlockModal(false);
                    setUnlockPassword('');
                  }}
                  className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={unlockNoteRequest}
                  className="flex-1 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors cursor-pointer"
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 animate-scale-in">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 text-center mb-2">
                {showSettings ? 'Delete Account?' : 'Delete Note?'}
              </h3>
              <p className="text-sm text-slate-500 text-center mb-6">
                {showSettings
                  ? 'This action cannot be undone. All your notes and data will be permanently deleted.'
                  : 'This action cannot be undone. The note will be permanently deleted.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (showSettings) {
                      deleteAccount();
                    } else {
                      deleteNote();
                    }
                  }}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guest Mode Popup */}
      {showGuestPopup && isGuestMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={() => setShowGuestPopup(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-scale-in overflow-hidden">
            <div className="p-6 flex justify-center">
              <svg className="w-24 h-24 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <div className="p-6 text-center">
              <h3 className="text-xl font-bold text-slate-800 mb-2">Keep Your Notes Safe!</h3>
              <p className="text-slate-500 text-sm mb-6">
                As a guest, your notes are locally stored, so losing them is very common. Please, create an account to keep your notes safe!
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowGuestPopup(false);
                    setIsGuestMode(false);
                    setNotes([]);
                    setAppState('signup');
                  }}
                  className="w-full bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 transition-colors cursor-pointer"
                >
                  Create Free Account
                </button>
                <button
                  onClick={() => setShowGuestPopup(false)}
                  className="w-full text-slate-500 py-2 text-sm hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Continue as Guest
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guest Limit Popup */}
      {showGuestLimitPopup && isGuestMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={() => setShowGuestLimitPopup(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-scale-in overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Account Required</h3>
              <p className="text-slate-500 text-sm mb-6">
                You need an account to use this feature. Sign up for free to unlock all features!
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowGuestLimitPopup(false);
                    setIsGuestMode(false);
                    setNotes([]);
                    setAppState('signup');
                  }}
                  className="w-full bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 transition-colors cursor-pointer"
                >
                  Create Free Account
                </button>
                <button
                  onClick={() => setShowGuestLimitPopup(false)}
                  className="w-full text-slate-500 py-2 text-sm hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Crop Modal */}
      {showCropModal && cropImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={() => {
            setShowCropModal(false);
            setCropImage('');
          }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-scale-in overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Crop Profile Picture</h3>
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setCropImage('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Crop Area */}
              <div 
                className="relative w-64 h-64 mx-auto rounded-full overflow-hidden bg-slate-100 cursor-move"
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onMouseLeave={handleCropMouseUp}
              >
                <div 
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${cropImage})`,
                    transform: `scale(${cropZoom}) translate(${cropPosition.x / cropZoom}px, ${cropPosition.y / cropZoom}px)`,
                    transformOrigin: 'center',
                  }}
                />
                {/* Circular overlay guide */}
                <div className="absolute inset-0 rounded-full border-4 border-white shadow-inner pointer-events-none" />
              </div>
              
              {/* Zoom Slider */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-slate-600 mb-2">Zoom</label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={cropZoom}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCropZoom(val);
                    cropZoomRef.current = val;
                  }}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
              </div>
              
              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setCropImage('');
                  }}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={applyCrop}
                  className="flex-1 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Overlay */}
    </div>
  );
}
