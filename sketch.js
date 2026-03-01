let videoElement, canvasCtx, canvasElement;
let hands, faceDetection, camera;
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];

// 모션 상태 변수
let showEffect = false;
let particles = [];

function setup() {
    let container = document.getElementById('canvas-container');
    let cnv = createCanvas(windowWidth / 2, windowHeight, P2D);
    cnv.parent(container);

    videoElement = document.getElementById('input_video');
    canvasElement = document.getElementById('output_canvas');
    canvasCtx = canvasElement.getContext('2d');

    // --- MediaPipe 설정 ---
    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    hands.onResults(onResults);

    faceDetection = new FaceDetection({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
    });
    faceDetection.setOptions({ modelSelection: 0, minDetectionConfidence: 0.5 });
    faceDetection.onResults(onFaceResults);

    camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
            await faceDetection.send({image: videoElement});
        },
        width: 640, height: 480
    });
    camera.start();

    // --- MediaRecorder 설정 ---
    const recordBtn = document.getElementById('record-btn');
    recordBtn.onclick = () => {
        if (!isRecording) {
            startRecording();
            recordBtn.innerText = "STOP & SAVE";
        } else {
            stopRecording();
            recordBtn.innerText = "RECORD START";
        }
    };
}

let faceRect = null;

function onFaceResults(results) {
    if (results.detections.length > 0) {
        faceRect = results.detections[0].boundingBox;
    }
}

function onResults(results) {
    // 좌측 캔버스에 웹캠 결과 그리기
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    showEffect = false;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length === 2) {
        // 포즈 검증: 두 손 모두 검지, 중지, 엄지가 펴져 있는지 확인 (간단한 y값 비교)
        let poseCount = 0;
        results.multiHandLandmarks.forEach(landmarks => {
            const isIndexUp = landmarks[8].y < landmarks[6].y;
            const isMiddleUp = landmarks[12].y < landmarks[10].y;
            const isThumbOut = Math.abs(landmarks[4].x - landmarks[2].x) > 0.05;
            
            if (isIndexUp && isMiddleUp && isThumbOut) poseCount++;
            
            // 손이 얼굴 근처에 있는지 확인 (정규화된 좌표 기준)
            if (faceRect) {
                const handX = landmarks[9].x;
                const handY = landmarks[9].y;
                if (handX > faceRect.xCenter - faceRect.width && handX < faceRect.xCenter + faceRect.width) {
                    // 얼굴 주변 감지됨 (필요시 추가 로직)
                }
            }
        });
        
        if (poseCount === 2) showEffect = true;
    }
    canvasCtx.restore();
}

function draw() {
    background(0);
    
    if (showEffect) {
        // 무지개빛 소용돌이 입자 생성
        if (particles.length < 100) {
            particles.push(new Particle());
        }
        
        for (let p of particles) {
            p.update();
            p.show();
        }
        
        // 텍스트 출력
        textAlign(CENTER);
        textSize(40);
        fill(255);
        text("SHUT YOUR BITCH ASS UP", width / 2, height / 2);
    } else {
        particles = [];
    }
}

class Particle {
    constructor() {
        this.pos = createVector(width / 2, height / 2);
        this.vel = p5.Vector.random2D().mult(random(2, 5));
        this.acc = createVector(0, 0);
        this.color = color(random(255), random(255), random(255));
    }
    update() {
        let mouse = createVector(width/2, height/2);
        this.acc = p5.Vector.sub(mouse, this.pos).setMag(0.1);
        this.vel.add(this.acc);
        this.pos.add(this.vel);
    }
    show() {
        noStroke();
        fill(this.color);
        ellipse(this.pos.x, this.pos.y, 8);
    }
}

function startRecording() {
    const stream = document.querySelector('#right-panel canvas').captureStream(30);
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
    mediaRecorder.onstop = saveVideo;
    mediaRecorder.start();
    isRecording = true;
}

function stopRecording() {
    mediaRecorder.stop();
    isRecording = false;
}

function saveVideo() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'motion-graphic.webm';
    a.click();
    recordedChunks = [];
}