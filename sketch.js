let videoElement;
let hands, faceDetection, camera;
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];

let showEffect = false;
let particles = [];

// p5.js 설정
function setup() {
    // 우측 패널 크기에 맞게 캔버스 생성
    const canvasContainer = document.getElementById('canvas-container');
    const renderer = createCanvas(windowWidth / 2, windowHeight);
    renderer.parent(canvasContainer);

    videoElement = document.getElementById('input_video');
    
    // 1. MediaPipe 초기화 (Hands & Face)
    initMediaPipe();

    // 2. 녹화 버튼 이벤트 연결
    const recordBtn = document.getElementById('record-btn');
    recordBtn.addEventListener('click', () => {
        if (!isRecording) {
            startRecording();
            recordBtn.innerText = "STOP & SAVE";
            recordBtn.style.background = "#ff4444";
        } else {
            stopRecording();
            recordBtn.innerText = "RECORD START";
            recordBtn.style.background = "#ffffff";
        }
    });
}

function initMediaPipe() {
    // Hands 설정
    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
    });
    hands.onResults(onResults);

    // Face 설정
    faceDetection = new FaceDetection({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
    });
    faceDetection.onResults(onFaceResults);

    // 카메라 시작 (좌측 canvas를 거치지 않고 직접 video element 사용)
    camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
            await faceDetection.send({image: videoElement});
        },
        width: 640,
        height: 480
    });
    camera.start().then(() => {
        console.log("Camera Started Successfully");
    });
}

let faceRect = null;
function onFaceResults(results) {
    if (results.detections && results.detections.length > 0) {
        faceRect = results.detections[0].boundingBox;
    }
}

function onResults(results) {
    // 좌측 화면(실시간 카메라 피드백) 업데이트
    const outCanvas = document.getElementById('output_canvas');
    const outCtx = outCanvas.getContext('2d');
    
    // 캔버스 크기 맞춤
    outCanvas.width = videoElement.videoWidth;
    outCanvas.height = videoElement.videoHeight;

    outCtx.save();
    outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
    
    // 거울 모드
    outCtx.translate(outCanvas.width, 0);
    outCtx.scale(-1, 1);
    outCtx.drawImage(results.image, 0, 0, outCanvas.width, outCanvas.height);
    
    // 포즈 감지 로직
    showEffect = false;
    if (results.multiHandLandmarks && results.multiHandLandmarks.length === 2) {
        let activeHands = 0;
        for (const landmarks of results.multiHandLandmarks) {
            // 검지(8), 중지(12)가 마디(6, 10)보다 위에 있는지 (y값은 작을수록 위)
            const isIndexUp = landmarks[8].y < landmarks[6].y;
            const isMiddleUp = landmarks[12].y < landmarks[10].y;
            const isThumbUp = landmarks[4].y < landmarks[3].y;

            if (isIndexUp && isMiddleUp && isThumbUp) activeHands++;
        }
        if (activeHands === 2) showEffect = true;
    }
    outCtx.restore();
}

function draw() {
    background(0); // 매 프레임 검은 배경으로 초기화
    
    if (showEffect) {
        // 모션 그래픽: 무지개빛 입자 소용돌이
        if (particles.length < 150) {
            particles.push(new Particle());
        }
        
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].show();
            if (particles[i].finished()) {
                particles.splice(i, 1);
            }
        }
        
        // 텍스트 출력
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(height * 0.05);
        text("SHUT YOUR BITCH ASS UP", width / 2, height / 2);
    } else {
        particles = []; // 포즈 없으면 입자 제거
    }
}

// 입자 클래스 (모션 그래픽용)
class Particle {
    constructor() {
        this.pos = createVector(width / 2, height / 2);
        this.vel = p5.Vector.random2D().mult(random(1, 4));
        this.acc = createVector(0, 0);
        this.lifespan = 255;
        this.color = color(random(100, 255), random(100, 255), random(255));
    }
    update() {
        let force = createVector(cos(frameCount * 0.1), sin(frameCount * 0.1));
        this.acc.add(force.mult(0.1));
        this.vel.add(this.acc);
        this.pos.add(this.vel);
        this.lifespan -= 2;
    }
    show() {
        noStroke();
        fill(red(this.color), green(this.color), blue(this.color), this.lifespan);
        ellipse(this.pos.x, this.pos.y, 10);
    }
    finished() { return this.lifespan < 0; }
}

// 녹화 기능
function startRecording() {
    const stream = document.querySelector('#canvas-container canvas').captureStream(30);