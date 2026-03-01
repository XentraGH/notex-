# NoteX Desktop App

A beautiful, cross-platform note-taking desktop application built with Python and Flet.

![NoteX](assets/images/notex-icon.png)

## Features

- **Create, Edit, Delete Notes** - Full CRUD operations for notes
- **Lock Notes** - Password protect your sensitive notes
- **Share Notes** - Share notes with other users
- **Offline Support** - Works offline with cached data
- **Auto-Sync** - Syncs offline changes when back online
- **Beautiful UI** - Modern, animated interface
- **Cross-Platform** - Works on Windows, macOS, and Linux

## Installation

### Prerequisites
- Python 3.9 or higher
- pip (Python package manager)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/XentraGH/notex-.git
   cd notex-/notex-desktop
   ```

2. **Create virtual environment** (recommended)
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the app**
   ```bash
   python notex_app.py
   ```

## Configuration

The app connects to the NoteX web API. By default, it connects to `http://localhost:3000`. 

To change the API URL, edit the `APIClient` initialization in `notex_app.py`:

```python
self.api = APIClient(self.storage, base_url="https://your-api-url.com")
```

## Building Executable

To build a standalone executable:

```bash
# Install pyinstaller
pip install pyinstaller

# Build executable
pyinstaller --onefile --windowed --add-data "assets;assets" notex_app.py
```

Or use Flet's built-in build command:

```bash
flet pack notex_app.py --add-data "assets" "assets"
```

## Offline Mode

The app automatically detects when you're offline and:
- Shows an amber "Offline Mode" indicator
- Loads notes from local cache
- Saves changes locally
- Syncs when connection is restored

## Screenshots

### Login Screen
Clean, modern login interface with the NoteX branding.

### Notes View
Sidebar with notes list and full editor with formatting.

### Offline Indicator
Amber badge showing when working offline.

## Tech Stack

- **Python 3.9+** - Core language
- **Flet** - UI framework (Flutter-based)
- **httpx** - Async HTTP client
- **JSON** - Local storage

## License

MIT License

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
