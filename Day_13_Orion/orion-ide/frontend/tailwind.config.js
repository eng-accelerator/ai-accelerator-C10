/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        orion: {
          bg: {
            primary: '#0B0B0D',   // canvas
            secondary: '#121214', // surface
            tertiary: '#19191D',  // surface raised
            activity: '#121214',
            titlebar: '#121214',
            input: '#19191D',
          },
          border: '#2B2B32',
          'border-subtle': '#1F1F24',
          text: {
            primary: '#F4F4F5',
            secondary: '#A1A1AA',
            muted: '#71717A',
          },
          accent: {
            blue: '#60A5FA',
            teal: '#4ADE80',
            red: '#FB7185',
            amber: '#FACC15',
            purple: '#8B5CF6',
            'purple-hover': '#A78BFA',
            soft: '#211B38',
          },
          selection: '#211B38',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
