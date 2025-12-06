# Canvas

> An infinite, immersive image exploration interface.

Canvas is a visual discovery tool that presents images in an infinite, physics-based floating grid. It features smooth panning, momentum-based interactions, and a premium glassmorphism aesthetic.

## Features

-   **Infinite Canvas**: Navigate a boundless space of images.
-   **Physics Interactions**: Smooth touch and mouse panning with momentum and friction.
-   **Smart Layout**: Randomized but non-overlapping grid generation.
-   **Single-Focus Mode**: Click an image to expand it while elegantly pushing neighbors away; click the background to restore them.
-   **Glassmorphism UI**: Modern, translucent interface elements with background blurring.
-   **Optimized Rendering**: Uses GPU-accelerated CSS transforms for silky smooth 60fps performance.

## Tech Stack

-   **Frontend**: React 19
-   **Build Tool**: Vite
-   **Styling**: Plain CSS with modern features (Variables, transforms, backdrop-filter)
-   **Font**: Outfit (Google Fonts)

## Getting Started

### Prerequisites

-   Node.js (v18+ recommended)
-   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/canvas.git
    cd canvas
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser at `http://localhost:5173`.

## Building for Production

To create a production build:

```bash
npm run build
```

The output will be in the `dist/` directory, ready to be deployed.

## License

This project is open-source and available under the [MIT License](LICENSE).
