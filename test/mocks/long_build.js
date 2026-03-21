console.log('🚀 Starting build...');
let progress = 0;
const interval = setInterval(() => {
  progress += 10;
  console.log(`[${progress}%] Building components...`);
  if (progress >= 100) {
    clearInterval(interval);
    console.log('✅ Build complete!');
  }
}, 500);
