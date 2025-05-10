// Global variables for AR application
let video;          // Video element for camera feed
let canvas;         // Canvas for drawing AR effects
let ctx;            // Canvas context for drawing
let faceMesh;       // MediaPipe Face Mesh instance
let isARActive = false;     // Tracks if AR is currently running
let camera;         // Camera instance
let bgMusic;        // Background music element
let catSound;       // Cat meow sound element
let isMusicPlaying = false; // Tracks music state
let isFrontCamera = true;  // Tracks camera direction
let animationFrame = 0; // For animations
let lastMouthOpenTime = 0;    // For sound cooldown
let mouthOpenThreshold = 0.15; // Threshold for mouth opening detection
let soundCooldown = 500; // Cooldown time in milliseconds between meows

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get references to HTML elements
    video = document.getElementById('camera');
    canvas = document.getElementById('overlay');
    ctx = canvas.getContext('2d');
    bgMusic = document.getElementById('bgMusic');
    catSound = document.getElementById('catSound');

    // Set up event listeners for controls
    document.getElementById('startAR').addEventListener('click', startAR);
    document.getElementById('exitAR').addEventListener('click', stopAR);
    document.getElementById('toggleMusic').addEventListener('click', toggleMusic);
    document.getElementById('takePhoto').addEventListener('click', takePhoto);
    document.getElementById('toggleCamera').addEventListener('click', toggleCamera);

    // Initialize MediaPipe Face Mesh
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });

    // Configure face mesh options
    faceMesh.setOptions({
        maxNumFaces: 1,          // Track only one face
        refineLandmarks: true,   // Use refined landmarks
        minDetectionConfidence: 0.5,  // Minimum confidence for detection
        minTrackingConfidence: 0.5    // Minimum confidence for tracking
    });

    // Set up callback for face mesh results
    faceMesh.onResults(onResults);
});

/**
 * Starts the AR experience by accessing the camera
 */
async function startAR() {
    try {
        // Request camera access with specified constraints
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: isFrontCamera ? 'user' : 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        
        // Set up video stream
        video.srcObject = stream;
        await video.play();
        
        // Show AR view and start face detection
        document.getElementById('arView').classList.remove('hidden');
        isARActive = true;
        detectFace();
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Could not access the camera. Please make sure you have granted camera permissions.');
    }
}

/**
 * Toggles between front and back cameras
 */
async function toggleCamera() {
    isFrontCamera = !isFrontCamera;
    if (isARActive) {
        stopAR();
        await startAR();
    }
}

/**
 * Captures the current AR view as a photo
 */
function takePhoto() {
    if (!isARActive) return;

    // Create a temporary canvas to combine video and overlay
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the video frame and overlay
    tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    tempCtx.drawImage(canvas, 0, 0);

    // Download the combined image
    const link = document.createElement('a');
    link.download = 'ar-photo.png';
    link.href = tempCanvas.toDataURL();
    link.click();
}

/**
 * Stops the AR experience and cleans up resources
 */
function stopAR() {
    // Stop camera and clear video stream
    if (camera) {
        camera.stop();
        camera = null;
    }
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }

    // Stop music and reset UI
    if (isMusicPlaying) {
        bgMusic.pause();
        isMusicPlaying = false;
        document.getElementById('toggleMusic').classList.remove('playing');
    }
    document.getElementById('arView').classList.add('hidden');
    isARActive = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Toggles background music playback
 */
function toggleMusic() {
    const musicButton = document.getElementById('toggleMusic');
    if (isMusicPlaying) {
        bgMusic.pause();
        musicButton.textContent = '🔊';
        musicButton.classList.remove('playing');
    } else {
        bgMusic.play();
        musicButton.textContent = '🔇';
        musicButton.classList.add('playing');
    }
    isMusicPlaying = !isMusicPlaying;
}

/**
 * Sets up face detection using MediaPipe
 */
function detectFace() {
    if (!isARActive) return;

    // Initialize camera with face detection
    camera = new Camera(video, {
        onFrame: async () => {
            if (isARActive && video.readyState === 4) {
                await faceMesh.send({image: video});
            }
        },
        width: 1280,
        height: 720
    });
    camera.start();
}

/**
 * Processes face tracking results and draws AR effects
 */
function onResults(results) {
    if (!isARActive) return;

    // Update canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Process detected faces
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        for (const landmarks of results.multiFaceLandmarks) {
            // Check for mouth opening and play meow sound
            checkMouthOpening(landmarks);
            
            // Draw cat filter
            drawSnapchatFilter(landmarks);
        }
    }

    // Update animation frame
    animationFrame = (animationFrame + 1) % 60;
}

/**
 * Detects mouth opening and triggers meow sound
 */
function checkMouthOpening(landmarks) {
    // Get mouth landmarks
    const upperLip = landmarks[13]; // Upper lip center
    const lowerLip = landmarks[14]; // Lower lip center
    
    // Calculate mouth opening distance
    const mouthOpenDistance = Math.hypot(
        (lowerLip.x - upperLip.x) * canvas.width,
        (lowerLip.y - upperLip.y) * canvas.height
    );
    
    // Get current time for cooldown
    const currentTime = Date.now();
    
    // Check if mouth is open enough and cooldown has passed
    if (mouthOpenDistance > mouthOpenThreshold && 
        currentTime - lastMouthOpenTime > soundCooldown) {
        // Play cat sound
        catSound.currentTime = 0;
        catSound.play().catch(error => {
            console.log('Error playing sound:', error);
        });
        
        // Update last mouth open time
        lastMouthOpenTime = currentTime;
    }
}

/**
 * Draws the cat filter on the face
 */
function drawSnapchatFilter(landmarks) {
    // Get key facial landmarks for filter placement
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const nose = landmarks[1];
    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];
    const chin = landmarks[152];
    const leftTemple = landmarks[234];
    const rightTemple = landmarks[454];
    const leftEyeInner = landmarks[133];
    const rightEyeInner = landmarks[362];
    const forehead = landmarks[10];

    // Calculate face dimensions for proper scaling
    const faceWidth = Math.hypot(
        (rightTemple.x - leftTemple.x) * canvas.width,
        (rightTemple.y - leftTemple.y) * canvas.height
    ) * 1.5;

    const faceHeight = Math.hypot(
        (nose.x - chin.x) * canvas.width,
        (nose.y - chin.y) * canvas.height
    ) * 2.2;

    // Draw cat ears with animation
    const earSize = faceWidth * 0.25;
    const earWiggle = Math.sin(animationFrame * 0.1) * 3;
    
    // Calculate ear positions
    const leftEarX = leftTemple.x * canvas.width;
    const leftEarY = forehead.y * canvas.height - faceHeight * 0.2;
    const rightEarX = rightTemple.x * canvas.width;
    const rightEarY = forehead.y * canvas.height - faceHeight * 0.2;

    // Draw left ear
    ctx.beginPath();
    ctx.moveTo(leftEarX, leftEarY);
    ctx.lineTo(
        leftEarX - earSize * 0.4 + earWiggle,
        leftEarY - earSize * 0.8
    );
    ctx.lineTo(
        leftEarX + earSize * 0.2,
        leftEarY - earSize * 0.2
    );
    ctx.closePath();
    ctx.fillStyle = '#F5F5DC';
    ctx.fill();

    // Draw right ear
    ctx.beginPath();
    ctx.moveTo(rightEarX, rightEarY);
    ctx.lineTo(
        rightEarX + earSize * 0.4 - earWiggle,
        rightEarY - earSize * 0.8
    );
    ctx.lineTo(
        rightEarX - earSize * 0.2,
        rightEarY - earSize * 0.2
    );
    ctx.closePath();
    ctx.fillStyle = '#F5F5DC';
    ctx.fill();

    // Draw inner ears with gradient
    const earGradient = ctx.createLinearGradient(0, 0, 0, earSize);
    earGradient.addColorStop(0, '#FFB6C1');
    earGradient.addColorStop(1, '#FF69B4');
    
    // Draw left inner ear
    ctx.beginPath();
    ctx.moveTo(leftEarX, leftEarY);
    ctx.lineTo(
        leftEarX - earSize * 0.25 + earWiggle,
        leftEarY - earSize * 0.6
    );
    ctx.lineTo(
        leftEarX + earSize * 0.15,
        leftEarY - earSize * 0.15
    );
    ctx.closePath();
    ctx.fillStyle = earGradient;
    ctx.fill();

    // Draw right inner ear
    ctx.beginPath();
    ctx.moveTo(rightEarX, rightEarY);
    ctx.lineTo(
        rightEarX + earSize * 0.25 - earWiggle,
        rightEarY - earSize * 0.6
    );
    ctx.lineTo(
        rightEarX - earSize * 0.15,
        rightEarY - earSize * 0.15
    );
    ctx.closePath();
    ctx.fillStyle = earGradient;
    ctx.fill();

    // Draw cat eyes with tracking
    const eyeSize = faceWidth * 0.12;
    const pupilSize = eyeSize * 0.4;
    
    // Calculate eye movement based on inner eye position
    const leftEyeMovement = {
        x: (leftEyeInner.x - leftEye.x) * 2,
        y: (leftEyeInner.y - leftEye.y) * 2
    };
    
    const rightEyeMovement = {
        x: (rightEyeInner.x - rightEye.x) * 2,
        y: (rightEyeInner.y - rightEye.y) * 2
    };

    // Draw left eye
    ctx.beginPath();
    ctx.ellipse(
        leftEye.x * canvas.width,
        leftEye.y * canvas.height,
        eyeSize,
        eyeSize * 0.8,
        0,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = '#FFD700';
    ctx.fill();

    // Draw left pupil
    ctx.beginPath();
    ctx.ellipse(
        leftEye.x * canvas.width + leftEyeMovement.x * eyeSize,
        leftEye.y * canvas.height + leftEyeMovement.y * eyeSize,
        pupilSize,
        pupilSize * 0.8,
        0,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Draw right eye
    ctx.beginPath();
    ctx.ellipse(
        rightEye.x * canvas.width,
        rightEye.y * canvas.height,
        eyeSize,
        eyeSize * 0.8,
        0,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = '#FFD700';
    ctx.fill();

    // Draw right pupil
    ctx.beginPath();
    ctx.ellipse(
        rightEye.x * canvas.width + rightEyeMovement.x * eyeSize,
        rightEye.y * canvas.height + rightEyeMovement.y * eyeSize,
        pupilSize,
        pupilSize * 0.8,
        0,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Draw cat nose with gradient
    const noseGradient = ctx.createLinearGradient(
        nose.x * canvas.width - faceWidth * 0.05,
        nose.y * canvas.height,
        nose.x * canvas.width + faceWidth * 0.05,
        nose.y * canvas.height + faceWidth * 0.05
    );
    noseGradient.addColorStop(0, '#FFB6C1');
    noseGradient.addColorStop(1, '#FF69B4');

    ctx.beginPath();
    ctx.moveTo(nose.x * canvas.width - faceWidth * 0.05, nose.y * canvas.height);
    ctx.lineTo(nose.x * canvas.width + faceWidth * 0.05, nose.y * canvas.height);
    ctx.lineTo(nose.x * canvas.width, nose.y * canvas.height + faceWidth * 0.05);
    ctx.closePath();
    ctx.fillStyle = noseGradient;
    ctx.fill();

    // Draw whiskers with animation
    const whiskerLength = faceWidth * 0.4;
    const whiskerWave = Math.sin(animationFrame * 0.1) * 5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;

    // Draw left whiskers
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(nose.x * canvas.width - faceWidth * 0.1, nose.y * canvas.height + i * 10);
        ctx.quadraticCurveTo(
            nose.x * canvas.width - faceWidth * 0.2,
            nose.y * canvas.height + i * 10 + whiskerWave,
            nose.x * canvas.width - faceWidth * 0.1 - whiskerLength,
            nose.y * canvas.height + i * 10
        );
        ctx.stroke();
    }

    // Draw right whiskers
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(nose.x * canvas.width + faceWidth * 0.1, nose.y * canvas.height + i * 10);
        ctx.quadraticCurveTo(
            nose.x * canvas.width + faceWidth * 0.2,
            nose.y * canvas.height + i * 10 + whiskerWave,
            nose.x * canvas.width + faceWidth * 0.1 + whiskerLength,
            nose.y * canvas.height + i * 10
        );
        ctx.stroke();
    }
}

/**
 * Draws a particle effect at the specified position
 */
function drawParticle(x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
}

function drawJewelNecklace(landmarks) {
    // Get key points for necklace placement
    const leftShoulder = landmarks[234]; // Left temple as shoulder reference
    const rightShoulder = landmarks[454]; // Right temple as shoulder reference
    const neck = landmarks[152]; // Chin as neck reference

    // Calculate necklace dimensions
    const necklaceWidth = Math.hypot(
        (rightShoulder.x - leftShoulder.x) * canvas.width,
        (rightShoulder.y - leftShoulder.y) * canvas.height
    ) * 1.2;

    const necklaceHeight = Math.hypot(
        (neck.x - leftShoulder.x) * canvas.width,
        (neck.y - leftShoulder.y) * canvas.height
    ) * 0.3;

    // Calculate necklace position
    const necklaceX = (leftShoulder.x + rightShoulder.x) * canvas.width / 2 - necklaceWidth / 2;
    const necklaceY = neck.y * canvas.height;

    // Draw the necklace chain
    ctx.beginPath();
    ctx.moveTo(necklaceX, necklaceY);
    ctx.quadraticCurveTo(
        necklaceX + necklaceWidth / 2,
        necklaceY + necklaceHeight,
        necklaceX + necklaceWidth,
        necklaceY
    );
    ctx.strokeStyle = '#FFD700'; // Gold color
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw jewels
    const numJewels = 5;
    const jewelColors = ['#FF0000', '#0000FF', '#00FF00', '#FF00FF', '#00FFFF'];
    const jewelSize = necklaceWidth * 0.08;

    for (let i = 0; i < numJewels; i++) {
        const t = i / (numJewels - 1);
        const jewelX = necklaceX + necklaceWidth * t;
        const jewelY = necklaceY + necklaceHeight * Math.sin(t * Math.PI);

        // Draw jewel
        ctx.beginPath();
        ctx.arc(jewelX, jewelY, jewelSize, 0, Math.PI * 2);
        ctx.fillStyle = jewelColors[i];
        ctx.fill();

        // Add sparkle effect
        const sparkleSize = jewelSize * 0.3;
        const sparkleAngle = animationFrame * 0.1 + i * Math.PI / 2;
        
        ctx.beginPath();
        ctx.arc(
            jewelX + Math.cos(sparkleAngle) * jewelSize * 0.5,
            jewelY + Math.sin(sparkleAngle) * jewelSize * 0.5,
            sparkleSize,
            0,
            Math.PI * 2
        );
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
    }
}

function drawDancingTeddy(landmarks) {
    // Get reference points for positioning
    const leftShoulder = landmarks[234]; // Left temple as shoulder reference
    const rightShoulder = landmarks[454]; // Right temple as shoulder reference
    const neck = landmarks[152]; // Chin as neck reference
    const forehead = landmarks[10]; // Forehead reference

    // Calculate teddy bear position (behind the head)
    const centerX = (leftShoulder.x + rightShoulder.x) * canvas.width / 2;
    // Position the teddy behind the head, using forehead as reference
    const centerY = forehead.y * canvas.height;

    // Calculate teddy bear size based on face width
    const faceWidth = Math.hypot(
        (rightShoulder.x - leftShoulder.x) * canvas.width,
        (rightShoulder.y - leftShoulder.y) * canvas.height
    );
    const teddySize = faceWidth * 0.6; // Slightly smaller to fit behind

    // Dancing animation
    const danceOffset = Math.sin(animationFrame * 0.2) * 5; // Reduced bounce
    const armWave = Math.sin(animationFrame * 0.3) * 10;
    const legWave = Math.sin(animationFrame * 0.25) * 8;

    // Draw teddy bear body (slightly transparent to show it's behind)
    ctx.globalAlpha = 0.8;
    
    // Draw teddy bear body
    ctx.beginPath();
    ctx.arc(centerX, centerY + danceOffset, teddySize * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#8B4513'; // Brown color
    ctx.fill();

    // Draw teddy bear head
    ctx.beginPath();
    ctx.arc(centerX, centerY - teddySize * 0.2 + danceOffset, teddySize * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#8B4513';
    ctx.fill();

    // Draw ears
    const earSize = teddySize * 0.15;
    // Left ear
    ctx.beginPath();
    ctx.arc(centerX - teddySize * 0.2, centerY - teddySize * 0.4 + danceOffset, earSize, 0, Math.PI * 2);
    ctx.fillStyle = '#8B4513';
    ctx.fill();
    // Right ear
    ctx.beginPath();
    ctx.arc(centerX + teddySize * 0.2, centerY - teddySize * 0.4 + danceOffset, earSize, 0, Math.PI * 2);
    ctx.fillStyle = '#8B4513';
    ctx.fill();

    // Draw face
    // Eyes
    ctx.beginPath();
    ctx.arc(centerX - teddySize * 0.1, centerY - teddySize * 0.25 + danceOffset, teddySize * 0.05, 0, Math.PI * 2);
    ctx.arc(centerX + teddySize * 0.1, centerY - teddySize * 0.25 + danceOffset, teddySize * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Nose
    ctx.beginPath();
    ctx.arc(centerX, centerY - teddySize * 0.15 + danceOffset, teddySize * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Draw arms
    // Left arm
    ctx.beginPath();
    ctx.moveTo(centerX - teddySize * 0.4, centerY + danceOffset);
    ctx.lineTo(centerX - teddySize * 0.6, centerY + teddySize * 0.2 + armWave + danceOffset);
    ctx.lineWidth = teddySize * 0.1;
    ctx.strokeStyle = '#8B4513';
    ctx.stroke();

    // Right arm
    ctx.beginPath();
    ctx.moveTo(centerX + teddySize * 0.4, centerY + danceOffset);
    ctx.lineTo(centerX + teddySize * 0.6, centerY + teddySize * 0.2 - armWave + danceOffset);
    ctx.lineWidth = teddySize * 0.1;
    ctx.strokeStyle = '#8B4513';
    ctx.stroke();

    // Draw legs
    // Left leg
    ctx.beginPath();
    ctx.moveTo(centerX - teddySize * 0.2, centerY + teddySize * 0.4 + danceOffset);
    ctx.lineTo(centerX - teddySize * 0.3, centerY + teddySize * 0.7 + legWave + danceOffset);
    ctx.lineWidth = teddySize * 0.1;
    ctx.strokeStyle = '#8B4513';
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(centerX + teddySize * 0.2, centerY + teddySize * 0.4 + danceOffset);
    ctx.lineTo(centerX + teddySize * 0.3, centerY + teddySize * 0.7 - legWave + danceOffset);
    ctx.lineWidth = teddySize * 0.1;
    ctx.strokeStyle = '#8B4513';
    ctx.stroke();

    // Add some sparkles around the teddy
    for (let i = 0; i < 5; i++) {
        const angle = (animationFrame * 0.1 + i * Math.PI * 2 / 5) % (Math.PI * 2);
        const sparkleX = centerX + Math.cos(angle) * teddySize * 0.8;
        const sparkleY = centerY + Math.sin(angle) * teddySize * 0.8 + danceOffset;
        drawParticle(sparkleX, sparkleY, teddySize * 0.05);
    }

    // Reset transparency
    ctx.globalAlpha = 1.0;
} 