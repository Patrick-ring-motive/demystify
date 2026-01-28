# Demystify

Transform minified JavaScript code into readable, understandable code with intelligent variable renaming.

## 🌟 Features

- **Smart Variable Renaming**: Automatically detects and renames minified variables based on their usage patterns
- **Scope-Aware**: Handles variable shadowing and nested scopes correctly
- **Context Analysis**: Infers meaningful names from assignment patterns and property access
- **Beautiful Formatting**: Applies consistent code formatting with proper indentation
- **Live Demo**: Interactive web interface with syntax highlighting

## 🚀 Demo

Try it live at: [https://patrick-ring-motive.github.io/demystify](https://patrick-ring-motive.github.io/demystify)

## 📦 Installation

```bash
npm install
```

## 🔧 Usage

### Command Line

```javascript
const demystify = require('./index.js');

const minifiedCode = `function a(b,c){let d=0;for(let e=0;e<b.length;e++){d+=b[e]*c}return d}`;
const readable = demystify(minifiedCode);
console.log(readable);
```

### Web Interface

Simply open `index.html` in a browser or deploy to GitHub Pages.

## 🎯 How It Works

Demystify uses a multi-pass approach to transform minified code:

1. **Scope Analysis**: Identifies variable scopes and resolves shadowing conflicts
2. **Pattern Matching**: Detects assignment patterns like `let x = SomeObject.property`
3. **Frequency Analysis**: Tracks which long names appear near short variable names
4. **Smart Renaming**: Renames variables to meaningful names based on context
5. **Code Generation**: Produces beautifully formatted output

### Example

**Input:**
```javascript
function a(b,c){let d=0;for(let e=0;e<b.length;e++){d+=b[e]*c}return d}
```

**Output:**
```javascript
function a(b, c) {
  let length$d = 0;
  for (let length$e = 0; length$e < b.length; length$e++) {
    length$d += b[length$e] * c;
  }
  return length$d;
}
```

## 🛠️ Technical Details

Built with:
- **[Acorn](https://github.com/acornjs/acorn)**: JavaScript parser for AST generation
- **[Acorn-Walk](https://github.com/acornjs/acorn)**: AST traversal utilities
- **[Astring](https://github.com/davidbonnet/astring)**: Code generation from AST
- **[JS Beautifier](https://beautifier.io/)**: Code formatting
- **[Prism](https://prismjs.com/)**: Syntax highlighting for the web interface

## 🌐 GitHub Pages Deployment

1. Commit both `index.html` and `index.js` to your repository
2. Go to Settings → Pages
3. Select your branch and root folder as source
4. Your demo will be live at `https://patrick-ring-motive.github.io/demystify`

## 📝 License

MIT

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## ⚠️ Limitations

- Works best with ES2020 and earlier JavaScript code
- Complex destructuring patterns may not be fully analyzed
- Some edge cases in scope resolution may produce suboptimal names
- Very large files may take time to process

## 💡 Tips

- Use Ctrl/Cmd + Enter in the web interface to quickly demystify code
- The tool runs in a Web Worker to keep the UI responsive
- For best results, use on code that has consistent naming patterns
