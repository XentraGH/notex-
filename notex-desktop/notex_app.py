"""
NoteX Desktop App - Python Version
A beautiful note-taking application built with Flet

Features:
- Create, edit, delete notes
- Lock notes with password
- Share notes with users
- Admin panel
- Offline detection
- Beautiful animations
"""

import flet as ft
import asyncio
import json
import os
import hashlib
from datetime import datetime
from typing import Optional, List, Dict, Any
import httpx
import threading

# ============================================
# CONFIGURATION
# ============================================

# Colors matching the web version
COLORS = {
    "primary": "#7c3aed",
    "primary_dark": "#6d28d9",
    "primary_light": "#a78bfa",
    "background": "#f8fafc",
    "card": "#ffffff",
    "text": "#1e293b",
    "text_secondary": "#64748b",
    "border": "#e2e8f0",
    "success": "#10b981",
    "warning": "#f59e0b",
    "error": "#ef4444",
    "locked": "#fbbf24",
    "offline_bg": "#fef3c7",
    "offline_text": "#78350f",
}

# ============================================
# OFFLINE STORAGE (Local JSON)
# ============================================

class OfflineStorage:
    """Handles local storage for offline mode"""
    
    STORAGE_FILE = "notex_offline_data.json"
    
    def __init__(self):
        self.data = self._load()
    
    def _load(self) -> Dict:
        try:
            if os.path.exists(self.STORAGE_FILE):
                with open(self.STORAGE_FILE, 'r') as f:
                    return json.load(f)
        except:
            pass
        return {
            "user": None,
            "notes": [],
            "online_notes": [],
            "sync_queue": []
        }
    
    def _save(self):
        try:
            with open(self.STORAGE_FILE, 'w') as f:
                json.dump(self.data, f, indent=2)
        except Exception as e:
            print(f"Failed to save offline data: {e}")
    
    def get_user(self) -> Optional[Dict]:
        return self.data.get("user")
    
    def set_user(self, user: Optional[Dict]):
        self.data["user"] = user
        self._save()
    
    def get_notes(self) -> List[Dict]:
        online = self.data.get("online_notes", [])
        offline = self.data.get("notes", [])
        notes_map = {n["id"]: n for n in online}
        notes_map.update({n["id"]: n for n in offline})
        notes = list(notes_map.values())
        notes.sort(key=lambda x: x.get("updatedAt", x.get("createdAt", "")), reverse=True)
        return notes
    
    def save_note(self, note: Dict):
        notes = self.data.get("notes", [])
        existing = next((n for n in notes if n["id"] == note["id"]), None)
        if existing:
            notes.remove(existing)
        notes.insert(0, note)
        self.data["notes"] = notes
        self._save()
    
    def delete_note(self, note_id: str):
        self.data["notes"] = [n for n in self.data.get("notes", []) if n["id"] != note_id]
        self._save()
    
    def set_online_notes(self, notes: List[Dict]):
        self.data["online_notes"] = notes
        self._save()
    
    def add_to_sync_queue(self, action: str, data: Dict):
        self.data.setdefault("sync_queue", []).append({
            "action": action,
            "data": data,
            "timestamp": datetime.now().isoformat()
        })
        self._save()
    
    def get_sync_queue(self) -> List[Dict]:
        return self.data.get("sync_queue", [])
    
    def clear_sync_queue(self):
        self.data["sync_queue"] = []
        self._save()


# ============================================
# API CLIENT
# ============================================

class APIClient:
    """Handles API communication with offline support"""
    
    def __init__(self, storage: OfflineStorage, base_url: str = "http://localhost:3000"):
        self.storage = storage
        self.base_url = base_url
        self.is_online = True
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def check_connection(self) -> bool:
        try:
            response = await self.client.get(f"{self.base_url}/api/seed", timeout=5.0)
            self.is_online = response.status_code < 500
            return self.is_online
        except:
            self.is_online = False
            return False
    
    async def login(self, username: str, password: str) -> Dict:
        if not self.is_online:
            return {"error": "You are offline. Please connect to the internet to login."}
        
        try:
            response = await self.client.post(
                f"{self.base_url}/api/auth/login",
                json={"username": username, "password": password}
            )
            data = response.json()
            if response.status_code == 200 and data.get("user"):
                self.storage.set_user(data["user"])
            return data
        except Exception as e:
            return {"error": str(e)}
    
    async def signup(self, name: str, username: str, password: str, image: str = None) -> Dict:
        if not self.is_online:
            return {"error": "You are offline. Please connect to the internet to signup."}
        
        try:
            response = await self.client.post(
                f"{self.base_url}/api/auth/signup",
                json={"name": name, "username": username, "password": password, "image": image}
            )
            data = response.json()
            if response.status_code == 200 and data.get("user"):
                self.storage.set_user(data["user"])
            return data
        except Exception as e:
            return {"error": str(e)}
    
    async def get_me(self) -> Dict:
        if not self.is_online:
            user = self.storage.get_user()
            if user:
                return {"user": user}
            return {"error": "Not authenticated"}
        
        try:
            response = await self.client.get(f"{self.base_url}/api/auth/me")
            data = response.json()
            if response.status_code == 200 and data.get("user"):
                self.storage.set_user(data["user"])
            return data
        except:
            user = self.storage.get_user()
            if user:
                return {"user": user}
            return {"error": "Not authenticated"}
    
    async def get_notes(self, author_id: str) -> List[Dict]:
        if not self.is_online:
            return self.storage.get_notes()
        
        try:
            response = await self.client.get(f"{self.base_url}/api/notes?authorId={author_id}")
            data = response.json()
            if response.status_code == 200:
                self.storage.set_online_notes(data.get("notes", []))
                return data.get("notes", [])
            return []
        except:
            return self.storage.get_notes()
    
    async def create_note(self, title: str, content: str, author_id: str) -> Dict:
        note = {
            "id": f"offline-{int(datetime.now().timestamp())}",
            "title": title,
            "content": content,
            "authorId": author_id,
            "isLocked": False,
            "password": None,
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat(),
            "offline": True
        }
        
        if not self.is_online:
            self.storage.save_note(note)
            self.storage.add_to_sync_queue("create", note)
            return {"note": note}
        
        try:
            response = await self.client.post(
                f"{self.base_url}/api/notes",
                json={"title": title, "content": content, "authorId": author_id}
            )
            data = response.json()
            if response.status_code == 200:
                self.storage.save_note(data.get("note", {}))
            return data
        except:
            self.storage.save_note(note)
            self.storage.add_to_sync_queue("create", note)
            return {"note": note}
    
    async def update_note(self, note_id: str, data: Dict) -> Dict:
        if not self.is_online:
            notes = self.storage.get_notes()
            note = next((n for n in notes if n["id"] == note_id), None)
            if note:
                note.update(data)
                note["updatedAt"] = datetime.now().isoformat()
                note["offline"] = True
                self.storage.save_note(note)
                self.storage.add_to_sync_queue("update", {"id": note_id, "data": data})
            return {"note": note}
        
        try:
            response = await self.client.put(f"{self.base_url}/api/notes/{note_id}", json=data)
            return response.json()
        except:
            return {"error": "Failed to update note"}
    
    async def delete_note(self, note_id: str) -> Dict:
        if not self.is_online:
            self.storage.delete_note(note_id)
            self.storage.add_to_sync_queue("delete", {"id": note_id})
            return {"success": True}
        
        try:
            response = await self.client.delete(f"{self.base_url}/api/notes/{note_id}")
            return response.json()
        except:
            return {"error": "Failed to delete note"}
    
    async def share_note(self, note_id: str, username: str) -> Dict:
        if not self.is_online:
            return {"error": "offline"}
        
        try:
            response = await self.client.post(
                f"{self.base_url}/api/notes/{note_id}/share",
                json={"username": username}
            )
            return response.json()
        except:
            return {"error": "Failed to share note"}
    
    async def update_settings(self, user_id: str, data: Dict) -> Dict:
        if not self.is_online:
            user = self.storage.get_user() or {}
            user.update(data)
            self.storage.set_user(user)
            return {"user": user}
        
        try:
            response = await self.client.put(
                f"{self.base_url}/api/user/settings/{user_id}",
                json=data
            )
            data = response.json()
            if response.status_code == 200:
                self.storage.set_user(data.get("user"))
            return data
        except:
            return {"error": "Failed to update settings"}
    
    async def sync_offline_changes(self):
        if not self.is_online:
            return
        
        queue = self.storage.get_sync_queue()
        if not queue:
            return
        
        for item in queue:
            try:
                if item["action"] == "create":
                    note_data = item["data"].copy()
                    if note_data["id"].startswith("offline-"):
                        del note_data["id"]
                    del note_data["offline"]
                    await self.client.post(f"{self.base_url}/api/notes", json=note_data)
                elif item["action"] == "update":
                    await self.client.put(
                        f"{self.base_url}/api/notes/{item['data']['id']}",
                        json=item["data"]["data"]
                    )
                elif item["action"] == "delete":
                    await self.client.delete(f"{self.base_url}/api/notes/{item['data']['id']}")
            except Exception as e:
                print(f"Sync error: {e}")
        
        self.storage.clear_sync_queue()


# ============================================
# MAIN APPLICATION
# ============================================

class NoteXApp:
    """Main NoteX Desktop Application"""
    
    def __init__(self, page: ft.Page):
        self.page = page
        self.storage = OfflineStorage()
        self.api = APIClient(self.storage)
        
        # App state
        self.user = self.storage.get_user()
        self.notes = []
        self.selected_note = None
        self.is_online = True
        self.search_query = ""
        self.showing_signup = False
        
        # Setup page
        self._setup_page()
        
        # Build UI
        self._build_ui()
        
        # Initialize
        self.page.run_task(self._initialize)
    
    def _setup_page(self):
        """Setup page properties"""
        self.page.title = "NoteX - Simple Note Taker"
        self.page.theme_mode = ft.ThemeMode.LIGHT
        self.page.bgcolor = COLORS["background"]
        self.page.window.width = 1200
        self.page.window.height = 800
        self.page.window.min_width = 800
        self.page.window.min_height = 600
        
        self.page.theme = ft.Theme(
            font_family="DM Sans",
            color_scheme=ft.ColorScheme(
                primary=COLORS["primary"],
                on_primary="white",
            )
        )
    
    def _build_ui(self):
        """Build the main UI"""
        # Create all views
        self._build_login_view()
        self._build_main_view()
        self._build_offline_overlay()
        self._build_offline_indicator()
        self._build_offline_popup()
        self._build_lock_dialog()
        self._build_share_dialog()
        self._build_settings_dialog()
        
        # Main stack
        self.main_stack = ft.Stack(
            controls=[
                self.login_view,
                self.main_view,
                self.offline_overlay,
                self.offline_indicator,
                self.offline_popup,
            ],
            expand=True,
        )
        
        self.page.add(self.main_stack)
        
        # Show initial view
        if self.user:
            self._show_view("main")
    
    # ============================================
    # LOGIN VIEW
    # ============================================
    
    def _build_login_view(self):
        """Build login/signup view"""
        
        # Logo with animation
        self.logo = ft.Container(
            content=ft.Image(
                src="/images/notex-icon.png",
                width=80,
                height=80,
                fit=ft.ImageFit.CONTAIN,
            ),
            animate=ft.animation.Animation(500, ft.AnimationCurve.ELASTIC_OUT),
        )
        
        # App title
        self.app_title = ft.Text(
            "NoteX",
            size=48,
            weight=ft.FontWeight.BOLD,
            color=COLORS["primary"],
            text_align=ft.TextAlign.CENTER,
        )
        
        self.app_subtitle = ft.Text(
            "Your simple note taker",
            size=18,
            color=COLORS["text_secondary"],
            text_align=ft.TextAlign.CENTER,
        )
        
        # Login fields
        self.login_username = ft.TextField(
            label="Username",
            prefix_icon=ft.icons.PERSON_OUTLINED,
            border_radius=12,
            border_color=COLORS["border"],
            focused_border_color=COLORS["primary"],
            cursor_color=COLORS["primary"],
            width=320,
            text_style=ft.TextStyle(size=16),
        )
        
        self.login_password = ft.TextField(
            label="Password",
            prefix_icon=ft.icons.LOCK_OUTLINE,
            password=True,
            can_reveal_password=True,
            border_radius=12,
            border_color=COLORS["border"],
            focused_border_color=COLORS["primary"],
            cursor_color=COLORS["primary"],
            width=320,
            text_style=ft.TextStyle(size=16),
            on_submit=lambda e: self._handle_login(e),
        )
        
        self.login_button = ft.ElevatedButton(
            "Login",
            style=ft.ButtonStyle(
                bgcolor=COLORS["primary"],
                color="white",
                padding=20,
                shape=ft.RoundedRectangleBorder(radius=12),
                text_style=ft.TextStyle(size=16, weight=ft.FontWeight.BOLD),
            ),
            width=320,
            on_click=self._handle_login,
        )
        
        self.signup_link = ft.TextButton(
            "Don't have an account? Sign up",
            style=ft.ButtonStyle(color=COLORS["primary"]),
            on_click=lambda e: self._toggle_auth_mode(True),
        )
        
        # Signup fields
        self.signup_name = ft.TextField(
            label="Name",
            prefix_icon=ft.icons.BADGE_OUTLINED,
            border_radius=12,
            border_color=COLORS["border"],
            focused_border_color=COLORS["primary"],
            cursor_color=COLORS["primary"],
            width=320,
            visible=False,
            text_style=ft.TextStyle(size=16),
        )
        
        self.signup_username = ft.TextField(
            label="Username",
            prefix_icon=ft.icons.PERSON_OUTLINED,
            border_radius=12,
            border_color=COLORS["border"],
            focused_border_color=COLORS["primary"],
            cursor_color=COLORS["primary"],
            width=320,
            visible=False,
            text_style=ft.TextStyle(size=16),
        )
        
        self.signup_password = ft.TextField(
            label="Password",
            prefix_icon=ft.icons.LOCK_OUTLINE,
            password=True,
            can_reveal_password=True,
            border_radius=12,
            border_color=COLORS["border"],
            focused_border_color=COLORS["primary"],
            cursor_color=COLORS["primary"],
            width=320,
            visible=False,
            text_style=ft.TextStyle(size=16),
        )
        
        self.signup_button = ft.ElevatedButton(
            "Sign Up",
            style=ft.ButtonStyle(
                bgcolor=COLORS["primary"],
                color="white",
                padding=20,
                shape=ft.RoundedRectangleBorder(radius=12),
                text_style=ft.TextStyle(size=16, weight=ft.FontWeight.BOLD),
            ),
            width=320,
            on_click=self._handle_signup,
            visible=False,
        )
        
        self.login_link = ft.TextButton(
            "Already have an account? Login",
            style=ft.ButtonStyle(color=COLORS["primary"]),
            on_click=lambda e: self._toggle_auth_mode(False),
            visible=False,
        )
        
        # Auth form container
        self.auth_form = ft.Column(
            controls=[
                self.logo,
                ft.Container(height=20),
                self.app_title,
                self.app_subtitle,
                ft.Container(height=40),
                # Login fields
                self.login_username,
                ft.Container(height=12),
                self.login_password,
                ft.Container(height=20),
                self.login_button,
                ft.Container(height=10),
                self.signup_link,
                # Signup fields
                self.signup_name,
                ft.Container(height=12),
                self.signup_username,
                ft.Container(height=12),
                self.signup_password,
                ft.Container(height=20),
                self.signup_button,
                ft.Container(height=10),
                self.login_link,
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            scroll=ft.ScrollMode.AUTO,
        )
        
        self.login_view = ft.Container(
            content=ft.Container(
                content=self.auth_form,
                padding=40,
                bgcolor=COLORS["card"],
                border_radius=20,
                shadow=ft.BoxShadow(
                    spread_radius=0,
                    blur_radius=30,
                    color=ft.colors.with_opacity(0.15, ft.colors.BLACK),
                    offset=ft.Offset(0, 10),
                ),
            ),
            alignment=ft.alignment.center,
            expand=True,
            visible=True,
            animate=ft.animation.Animation(300, ft.AnimationCurve.EASE_OUT),
        )
    
    # ============================================
    # MAIN VIEW
    # ============================================
    
    def _build_main_view(self):
        """Build main app view"""
        
        # Header
        self.search_field = ft.TextField(
            hint_text="Search notes...",
            prefix_icon=ft.icons.SEARCH,
            border_radius=12,
            border_color=COLORS["border"],
            focused_border_color=COLORS["primary"],
            width=280,
            on_change=self._handle_search,
        )
        
        self.user_avatar = ft.PopupMenuButton(
            content=ft.CircleAvatar(
                content=ft.Icon(ft.icons.PERSON, color="white", size=18),
                bgcolor=COLORS["primary"],
                radius=18,
            ),
            items=[
                ft.PopupMenuItem(text="Settings", icon=ft.icons.SETTINGS, on_click=self._show_settings),
                ft.PopupMenuItem(text="Logout", icon=ft.icons.LOGOUT, on_click=self._handle_logout),
            ],
        )
        
        self.header = ft.Container(
            content=ft.Row(
                controls=[
                    ft.Row(
                        controls=[
                            ft.Image(src="/images/notex-icon.png", width=36, height=36),
                            ft.Text(
                                "NoteX",
                                size=24,
                                weight=ft.FontWeight.BOLD,
                                color=COLORS["primary"],
                            ),
                        ],
                        spacing=10,
                    ),
                    ft.Row(
                        controls=[
                            self.search_field,
                            ft.Container(width=10),
                            self.user_avatar,
                        ],
                    ),
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            padding=ft.padding.symmetric(horizontal=20, vertical=12),
            bgcolor=COLORS["card"],
            border=ft.border.only(bottom=ft.BorderSide(1, COLORS["border"])),
        )
        
        # Notes sidebar
        self.new_note_btn = ft.FloatingActionButton(
            icon=ft.icons.ADD,
            bgcolor=COLORS["primary"],
            mini=True,
            on_click=self._create_note,
        )
        
        self.notes_list = ft.ListView(
            expand=True,
            spacing=8,
            padding=ft.padding.all(12),
        )
        
        self.sidebar = ft.Container(
            content=ft.Column(
                controls=[
                    ft.Container(
                        content=ft.Row(
                            controls=[
                                ft.Text(
                                    "Your Notes",
                                    size=16,
                                    weight=ft.FontWeight.BOLD,
                                    color=COLORS["text"],
                                ),
                                self.new_note_btn,
                            ],
                            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        ),
                        padding=ft.padding.all(12),
                    ),
                    ft.Divider(height=1, color=COLORS["border"]),
                    self.notes_list,
                ],
            ),
            width=280,
            bgcolor=COLORS["card"],
            border=ft.border.only(right=ft.BorderSide(1, COLORS["border"])),
            expand=True,
        )
        
        # Note editor
        self.note_title = ft.TextField(
            hint_text="Untitled Note",
            border=ft.InputBorder.NONE,
            text_style=ft.TextStyle(size=28, weight=ft.FontWeight.BOLD, color=COLORS["text"]),
            expand=True,
            on_change=self._update_note_title,
        )
        
        self.note_content = ft.TextField(
            hint_text="Start writing...",
            border=ft.InputBorder.NONE,
            multiline=True,
            min_lines=15,
            expand=True,
            text_style=ft.TextStyle(size=16, color=COLORS["text"]),
            on_change=self._update_note_content,
        )
        
        self.lock_btn = ft.IconButton(
            icon=ft.icons.LOCK_OPEN_ROUNDED,
            icon_color=COLORS["text_secondary"],
            tooltip="Lock note",
            on_click=self._show_lock_dialog,
        )
        
        self.share_btn = ft.IconButton(
            icon=ft.icons.SHARE_ROUNDED,
            icon_color=COLORS["text_secondary"],
            tooltip="Share note",
            on_click=self._show_share_dialog,
        )
        
        self.delete_btn = ft.IconButton(
            icon=ft.icons.DELETE_ROUNDED,
            icon_color=COLORS["error"],
            tooltip="Delete note",
            on_click=self._confirm_delete,
        )
        
        self.editor_toolbar = ft.Container(
            content=ft.Row(
                controls=[
                    self.note_title,
                    ft.Row(
                        controls=[
                            self.lock_btn,
                            self.share_btn,
                            self.delete_btn,
                        ],
                    ),
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            padding=ft.padding.all(16),
            bgcolor=COLORS["card"],
            border=ft.border.only(bottom=ft.BorderSide(1, COLORS["border"])),
        )
        
        self.editor_content = ft.Container(
            content=self.note_content,
            padding=ft.padding.all(20),
            expand=True,
        )
        
        # Empty state
        self.empty_state = ft.Column(
            controls=[
                ft.Container(height=100),
                ft.Icon(ft.icons.NOTE_ALT_OUTLINED, size=100, color=COLORS["border"]),
                ft.Container(height=20),
                ft.Text(
                    "Select a note or create a new one",
                    size=18,
                    color=COLORS["text_secondary"],
                ),
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            alignment=ft.MainAxisAlignment.CENTER,
            expand=True,
        )
        
        self.editor_area = ft.Container(
            content=self.empty_state,
            expand=True,
            bgcolor=COLORS["background"],
        )
        
        self.main_view = ft.Container(
            content=ft.Column(
                controls=[
                    self.header,
                    ft.Row(
                        controls=[
                            self.sidebar,
                            self.editor_area,
                        ],
                        expand=True,
                    ),
                ],
                expand=True,
            ),
            expand=True,
            visible=False,
            animate=ft.animation.Animation(300, ft.AnimationCurve.EASE_OUT),
        )
    
    # ============================================
    # OFFLINE OVERLAY
    # ============================================
    
    def _build_offline_overlay(self):
        """Build full-screen offline overlay"""
        
        self.offline_overlay = ft.Container(
            content=ft.Column(
                controls=[
                    ft.Container(height=50),
                    ft.Container(
                        content=ft.Icon(ft.icons.WIFI_OFF_ROUNDED, size=64, color="#d97706"),
                        width=160,
                        height=160,
                        bgcolor=ft.colors.with_opacity(0.5, "#fef3c7"),
                        border_radius=80,
                        alignment=ft.alignment.center,
                        animate=ft.animation.Animation(1000, ft.AnimationCurve.ELASTIC_OUT),
                    ),
                    ft.Container(height=40),
                    ft.Text(
                        "No Internet Connection!",
                        size=36,
                        weight=ft.FontWeight.BOLD,
                        color="#78350f",
                        text_align=ft.TextAlign.CENTER,
                    ),
                    ft.Container(height=16),
                    ft.Text(
                        "Your device is not connected to the internet.\nPlease, check your internet connection.",
                        size=18,
                        color="#92400e",
                        text_align=ft.TextAlign.CENTER,
                    ),
                    ft.Container(height=40),
                    ft.Row(
                        controls=[
                            ft.ProgressIndicator(color="#f59e0b", width=20, height=20),
                            ft.Text("Waiting for connection...", size=16, color="#b45309"),
                        ],
                        alignment=ft.MainAxisAlignment.CENTER,
                    ),
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            ),
            bgcolor=ft.LinearGradient(
                begin=ft.alignment.top_left,
                end=ft.alignment.bottom_right,
                colors=["#fef3c7", "#fde68a", "#fcd34d"],
            ),
            expand=True,
            visible=False,
            animate=ft.animation.Animation(300, ft.AnimationCurve.EASE_OUT),
        )
    
    # ============================================
    # OFFLINE INDICATOR
    # ============================================
    
    def _build_offline_indicator(self):
        """Build offline mode indicator badge"""
        
        self.offline_indicator = ft.Container(
            content=ft.Row(
                controls=[
                    ft.Icon(ft.icons.WIFI_OFF_ROUNDED, size=16, color="white"),
                    ft.Text("Offline Mode", size=14, color="white", weight=ft.FontWeight.BOLD),
                ],
                spacing=8,
            ),
            bgcolor=COLORS["warning"],
            padding=ft.padding.symmetric(horizontal=16, vertical=10),
            border_radius=12,
            left=20,
            bottom=20,
            visible=False,
            animate=ft.animation.Animation(300, ft.AnimationCurve.EASE_OUT),
        )
    
    # ============================================
    # OFFLINE POPUP
    # ============================================
    
    def _build_offline_popup(self):
        """Build offline feature popup dialog"""
        
        self.popup_message = ft.Text(
            "This feature requires an internet connection.",
            size=15,
            color=COLORS["text"],
            text_align=ft.TextAlign.CENTER,
        )
        
        self.offline_popup = ft.Container(
            content=ft.Container(
                content=ft.Column(
                    controls=[
                        ft.Container(
                            content=ft.Icon(ft.icons.WIFI_OFF_ROUNDED, size=32, color="#d97706"),
                            width=64,
                            height=64,
                            bgcolor="#fef3c7",
                            border_radius=32,
                            alignment=ft.alignment.center,
                        ),
                        ft.Container(height=20),
                        ft.Text(
                            "Offline Feature",
                            size=22,
                            weight=ft.FontWeight.BOLD,
                            color="#78350f",
                        ),
                        ft.Container(height=12),
                        self.popup_message,
                        ft.Container(height=24),
                        ft.ElevatedButton(
                            "Got it",
                            style=ft.ButtonStyle(
                                bgcolor=COLORS["primary"],
                                color="white",
                                padding=ft.padding.symmetric(horizontal=32, vertical=12),
                                shape=ft.RoundedRectangleBorder(radius=8),
                            ),
                            on_click=lambda e: self._hide_offline_popup(),
                        ),
                    ],
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                ),
                bgcolor=COLORS["card"],
                padding=32,
                border_radius=16,
                width=380,
                shadow=ft.BoxShadow(
                    spread_radius=0,
                    blur_radius=25,
                    color=ft.colors.with_opacity(0.3, ft.colors.BLACK),
                ),
            ),
            bgcolor=ft.colors.with_opacity(0.5, ft.colors.BLACK),
            alignment=ft.alignment.center,
            expand=True,
            visible=False,
            animate=ft.animation.Animation(200, ft.AnimationCurve.EASE_OUT),
        )
    
    # ============================================
    # LOCK DIALOG
    # ============================================
    
    def _build_lock_dialog(self):
        """Build lock note dialog"""
        
        self.lock_password = ft.TextField(
            label="Password",
            password=True,
            can_reveal_password=True,
            border_radius=12,
            width=280,
        )
        
        self.lock_dialog = ft.AlertDialog(
            title=ft.Text("Lock Note"),
            content=ft.Column(
                controls=[
                    ft.Text("Enter a password to lock this note:"),
                    ft.Container(height=10),
                    self.lock_password,
                ],
                tight=True,
            ),
            actions=[
                ft.TextButton("Cancel", on_click=lambda e: self._close_dialog()),
                ft.ElevatedButton(
                    "Lock",
                    bgcolor=COLORS["primary"],
                    color="white",
                    on_click=self._apply_lock,
                ),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
    
    # ============================================
    # SHARE DIALOG
    # ============================================
    
    def _build_share_dialog(self):
        """Build share note dialog"""
        
        self.share_username = ft.TextField(
            label="Username",
            border_radius=12,
            width=280,
        )
        
        self.share_dialog = ft.AlertDialog(
            title=ft.Text("Share Note"),
            content=ft.Column(
                controls=[
                    ft.Text("Enter the username to share with:"),
                    ft.Container(height=10),
                    self.share_username,
                ],
                tight=True,
            ),
            actions=[
                ft.TextButton("Cancel", on_click=lambda e: self._close_dialog()),
                ft.ElevatedButton(
                    "Share",
                    bgcolor=COLORS["primary"],
                    color="white",
                    on_click=self._apply_share,
                ),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
    
    # ============================================
    # SETTINGS DIALOG
    # ============================================
    
    def _build_settings_dialog(self):
        """Build settings dialog"""
        
        self.settings_name = ft.TextField(
            label="Name",
            border_radius=12,
            width=280,
        )
        
        self.settings_username = ft.TextField(
            label="Username",
            border_radius=12,
            width=280,
            read_only=True,
        )
        
        self.settings_dialog = ft.AlertDialog(
            title=ft.Text("Settings"),
            content=ft.Column(
                controls=[
                    ft.Text("Update your profile:"),
                    ft.Container(height=10),
                    self.settings_name,
                    ft.Container(height=10),
                    self.settings_username,
                ],
                tight=True,
            ),
            actions=[
                ft.TextButton("Cancel", on_click=lambda e: self._close_dialog()),
                ft.ElevatedButton(
                    "Save",
                    bgcolor=COLORS["primary"],
                    color="white",
                    on_click=self._save_settings,
                ),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
    
    # ============================================
    # INITIALIZATION
    # ============================================
    
    async def _initialize(self):
        """Initialize app"""
        # Check connection
        self.is_online = await self.api.check_connection()
        
        if not self.is_online:
            if not self.user:
                self._show_offline_overlay()
            else:
                self._show_offline_indicator()
                await self._load_notes()
        else:
            await self.api.sync_offline_changes()
            if self.user:
                await self._load_notes()
        
        # Start connection monitor
        self.page.run_task(self._monitor_connection)
    
    async def _monitor_connection(self):
        """Monitor internet connection"""
        while True:
            await asyncio.sleep(5)
            was_online = self.is_online
            self.is_online = await self.api.check_connection()
            
            if was_online and not self.is_online:
                if self.user:
                    self._show_offline_indicator()
                else:
                    self._show_offline_overlay()
            elif not was_online and self.is_online:
                self._hide_offline_indicator()
                self._hide_offline_overlay()
                await self.api.sync_offline_changes()
                if self.user:
                    await self._load_notes()
    
    # ============================================
    # VIEW MANAGEMENT
    # ============================================
    
    def _show_view(self, view: str):
        """Show specific view"""
        self.login_view.visible = view == "login"
        self.main_view.visible = view == "main"
        self.page.update()
    
    def _toggle_auth_mode(self, signup: bool):
        """Toggle between login and signup"""
        self.showing_signup = signup
        
        self.login_username.visible = not signup
        self.login_password.visible = not signup
        self.login_button.visible = not signup
        self.signup_link.visible = not signup
        
        self.signup_name.visible = signup
        self.signup_username.visible = signup
        self.signup_password.visible = signup
        self.signup_button.visible = signup
        self.login_link.visible = signup
        
        self.page.update()
    
    # ============================================
    # EVENT HANDLERS
    # ============================================
    
    async def _handle_login(self, e):
        """Handle login"""
        if not self.login_username.value or not self.login_password.value:
            self._show_snackbar("Please fill in all fields", COLORS["error"])
            return
        
        result = await self.api.login(
            self.login_username.value,
            self.login_password.value
        )
        
        if result.get("error"):
            self._show_snackbar(result["error"], COLORS["error"])
        else:
            self.user = result.get("user")
            self.storage.set_user(self.user)
            self._show_view("main")
            await self._load_notes()
    
    async def _handle_signup(self, e):
        """Handle signup"""
        if not self.signup_name.value or not self.signup_username.value or not self.signup_password.value:
            self._show_snackbar("Please fill in all fields", COLORS["error"])
            return
        
        result = await self.api.signup(
            self.signup_name.value,
            self.signup_username.value,
            self.signup_password.value
        )
        
        if result.get("error"):
            self._show_snackbar(result["error"], COLORS["error"])
        else:
            self.user = result.get("user")
            self.storage.set_user(self.user)
            self._show_view("main")
            await self._load_notes()
    
    async def _handle_logout(self, e):
        """Handle logout"""
        self.user = None
        self.storage.set_user(None)
        self.notes = []
        self.selected_note = None
        self._show_view("login")
        self._hide_offline_indicator()
    
    async def _load_notes(self):
        """Load notes"""
        if self.user:
            self.notes = await self.api.get_notes(self.user.get("id"))
            self._render_notes()
    
    def _render_notes(self):
        """Render notes list"""
        self.notes_list.controls.clear()
        
        filtered = self.notes
        if self.search_query:
            filtered = [
                n for n in self.notes
                if self.search_query.lower() in n.get("title", "").lower()
                or self.search_query.lower() in n.get("content", "").lower()
            ]
        
        for note in filtered:
            is_selected = self.selected_note and self.selected_note.get("id") == note.get("id")
            is_locked = note.get("isLocked")
            
            card = ft.Container(
                content=ft.Column(
                    controls=[
                        ft.Row(
                            controls=[
                                ft.Icon(
                                    ft.icons.LOCK_ROUNDED if is_locked else ft.icons.NOTE_ROUNDED,
                                    size=18,
                                    color=COLORS["warning"] if is_locked else COLORS["text_secondary"],
                                ),
                                ft.Text(
                                    note.get("title", "Untitled")[:25],
                                    size=14,
                                    weight=ft.FontWeight.W_500,
                                    color=COLORS["text"],
                                    overflow=ft.TextOverflow.ELLIPSIS,
                                    expand=True,
                                ),
                            ],
                        ),
                        ft.Container(height=4),
                        ft.Text(
                            note.get("content", "")[:40] or "No content",
                            size=12,
                            color=COLORS["text_secondary"],
                            overflow=ft.TextOverflow.ELLIPSIS,
                        ),
                    ],
                    spacing=4,
                ),
                padding=12,
                bgcolor=COLORS["primary_light"] if is_selected else COLORS["card"],
                border_radius=10,
                border=ft.border.all(1, COLORS["primary"] if is_selected else COLORS["border"]),
                on_click=lambda e, n=note: self._select_note(n),
                on_hover=lambda e, c: self._hover_note(e, c),
                animate=ft.animation.Animation(150, ft.AnimationCurve.EASE_OUT),
            )
            self.notes_list.controls.append(card)
        
        self.page.update()
    
    def _hover_note(self, e, card):
        """Handle note hover"""
        if self.selected_note and self.selected_note.get("id") != card.key:
            card.bgcolor = ft.colors.with_opacity(0.5, COLORS["primary"]) if e.data == "true" else COLORS["card"]
            card.update()
    
    def _select_note(self, note):
        """Select a note"""
        self.selected_note = note
        self.note_title.value = note.get("title", "")
        self.note_content.value = note.get("content", "")
        
        # Update lock icon
        self.lock_btn.icon = ft.icons.LOCK_ROUNDED if note.get("isLocked") else ft.icons.LOCK_OPEN_ROUNDED
        self.lock_btn.icon_color = COLORS["warning"] if note.get("isLocked") else COLORS["text_secondary"]
        
        # Show editor
        self.editor_area.content = ft.Column(
            controls=[
                self.editor_toolbar,
                self.editor_content,
            ],
            expand=True,
        )
        
        self._render_notes()
    
    async def _create_note(self, e):
        """Create new note"""
        if not self.user:
            return
        
        result = await self.api.create_note("Untitled Note", "", self.user.get("id"))
        if result.get("note"):
            self.notes.insert(0, result["note"])
            self._select_note(result["note"])
            self._render_notes()
    
    async def _update_note_title(self, e):
        """Update note title"""
        if self.selected_note:
            await self.api.update_note(
                self.selected_note["id"],
                {"title": self.note_title.value}
            )
            self.selected_note["title"] = self.note_title.value
            self._render_notes()
    
    async def _update_note_content(self, e):
        """Update note content"""
        if self.selected_note:
            await self.api.update_note(
                self.selected_note["id"],
                {"content": self.note_content.value}
            )
            self.selected_note["content"] = self.note_content.value
    
    def _handle_search(self, e):
        """Handle search"""
        self.search_query = e.control.value
        self._render_notes()
    
    # ============================================
    # DIALOG HANDLERS
    # ============================================
    
    def _show_lock_dialog(self, e):
        """Show lock dialog"""
        if not self.is_online:
            self._show_offline_popup("Locking notes requires an internet connection.")
            return
        self.lock_password.value = ""
        self.page.open_dialog(self.lock_dialog)
    
    def _show_share_dialog(self, e):
        """Show share dialog"""
        if not self.is_online:
            self._show_offline_popup("Sharing notes requires an internet connection. Your note is saved locally and can be shared when you're back online.")
            return
        self.share_username.value = ""
        self.page.open_dialog(self.share_dialog)
    
    def _show_settings(self, e):
        """Show settings dialog"""
        if self.user:
            self.settings_name.value = self.user.get("name", "")
            self.settings_username.value = self.user.get("username", "")
        self.page.open_dialog(self.settings_dialog)
    
    def _close_dialog(self):
        """Close dialog"""
        self.page.close_dialog()
    
    async def _apply_lock(self, e):
        """Apply lock to note"""
        if not self.selected_note or not self.lock_password.value:
            return
        
        result = await self.api.update_note(
            self.selected_note["id"],
            {"isLocked": True, "password": self.lock_password.value}
        )
        
        if result.get("note"):
            self.selected_note["isLocked"] = True
            self.selected_note["password"] = self.lock_password.value
            self.lock_btn.icon = ft.icons.LOCK_ROUNDED
            self.lock_btn.icon_color = COLORS["warning"]
            self._render_notes()
            self._show_snackbar("Note locked!", COLORS["success"])
        
        self._close_dialog()
    
    async def _apply_share(self, e):
        """Share note with user"""
        if not self.selected_note or not self.share_username.value:
            return
        
        result = await self.api.share_note(
            self.selected_note["id"],
            self.share_username.value
        )
        
        if result.get("error"):
            self._show_snackbar(result["error"], COLORS["error"])
        else:
            self._show_snackbar(f"Note shared with {self.share_username.value}!", COLORS["success"])
        
        self._close_dialog()
    
    async def _save_settings(self, e):
        """Save settings"""
        if not self.user:
            return
        
        result = await self.api.update_settings(
            self.user.get("id"),
            {"name": self.settings_name.value}
        )
        
        if result.get("user"):
            self.user = result["user"]
            self.storage.set_user(self.user)
            self._show_snackbar("Settings saved!", COLORS["success"])
        
        self._close_dialog()
    
    async def _confirm_delete(self, e):
        """Confirm delete note"""
        if not self.selected_note:
            return
        
        # Simple confirmation
        self.page.open_dialog(
            ft.AlertDialog(
                title=ft.Text("Delete Note"),
                content=ft.Text("Are you sure you want to delete this note?"),
                actions=[
                    ft.TextButton("Cancel", on_click=lambda e: self._close_dialog()),
                    ft.ElevatedButton(
                        "Delete",
                        bgcolor=COLORS["error"],
                        color="white",
                        on_click=self._delete_note,
                    ),
                ],
                actions_alignment=ft.MainAxisAlignment.END,
            )
        )
    
    async def _delete_note(self, e):
        """Delete note"""
        if self.selected_note:
            await self.api.delete_note(self.selected_note["id"])
            self.notes = [n for n in self.notes if n["id"] != self.selected_note["id"]]
            self.selected_note = None
            
            # Show empty state
            self.editor_area.content = self.empty_state
            self.note_title.value = ""
            self.note_content.value = ""
            
            self._render_notes()
            self._show_snackbar("Note deleted", COLORS["success"])
        
        self._close_dialog()
    
    # ============================================
    # OFFLINE UI METHODS
    # ============================================
    
    def _show_offline_overlay(self):
        """Show offline overlay"""
        self.offline_overlay.visible = True
        self.page.update()
    
    def _hide_offline_overlay(self):
        """Hide offline overlay"""
        self.offline_overlay.visible = False
        self.page.update()
    
    def _show_offline_indicator(self):
        """Show offline indicator"""
        self.offline_indicator.visible = True
        self.page.update()
    
    def _hide_offline_indicator(self):
        """Hide offline indicator"""
        self.offline_indicator.visible = False
        self.page.update()
    
    def _show_offline_popup(self, message: str = None):
        """Show offline popup"""
        self.popup_message.value = message or "This feature requires an internet connection."
        self.offline_popup.visible = True
        self.page.update()
    
    def _hide_offline_popup(self):
        """Hide offline popup"""
        self.offline_popup.visible = False
        self.page.update()
    
    def _show_snackbar(self, message: str, color: str = COLORS["primary"]):
        """Show snackbar"""
        self.page.snack_bar = ft.SnackBar(
            content=ft.Text(message, color="white"),
            bgcolor=color,
            duration=3000,
        )
        self.page.snack_bar.open = True
        self.page.update()


# ============================================
# MAIN ENTRY POINT
# ============================================

def main(page: ft.Page):
    """Main entry point"""
    NoteXApp(page)


if __name__ == "__main__":
    ft.app(
        target=main,
        assets_dir="assets",
        view=ft.AppView.WEB_BROWSER,  # Run in browser mode for compatibility
    )
