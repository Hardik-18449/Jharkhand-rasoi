import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Camera, MapPin, X, AlertTriangle, Loader2, CheckCircle2, UserCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

// Cached BlazeFace model instance across modal toggles
let cachedBlazeFaceModel = null;
let modelLoadingPromise = null;

const loadBlazeFaceModel = async () => {
  if (cachedBlazeFaceModel) return cachedBlazeFaceModel;
  if (!modelLoadingPromise) {
    modelLoadingPromise = (async () => {
      try {
        await import('@tensorflow/tfjs');
        const blazeface = await import('@tensorflow-models/blazeface');
        const model = await blazeface.load();
        cachedBlazeFaceModel = model;
        return model;
      } catch (err) {
        console.error('[FaceScanner] Failed to load BlazeFace:', err);
        modelLoadingPromise = null;
        throw err;
      }
    })();
  }
  return modelLoadingPromise;
};

export function PhotoUploadModal({ isOpen, onClose, onUpload }) {
  const [photoPreview, setPhotoPreview] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [locationState, setLocationState] = useState({ loading: false, address: null, error: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Camera & Face Detection State
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isCameraActiveRef = useRef(false);
  const animFrameRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceStatusText, setFaceStatusText] = useState('Initializing Face Scanner...');
  const [detecting, setDetecting] = useState(true);

  const startCamera = async () => {
    try {
      setCameraError(null);
      setFaceDetected(false);
      setDetecting(true);
      setFaceStatusText('Starting Camera...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      
      streamRef.current = stream;
      isCameraActiveRef.current = true;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (_) {}
      }
      setIsCameraActive(true);
      
      // Start Real AI Face Detection loop
      detectFaceLoop();
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Camera access denied or unavailable. Please grant camera permission.");
      setDetecting(false);
    }
  };

  const stopCamera = useCallback(() => {
    isCameraActiveRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setDetecting(false);
    setFaceDetected(false);
  }, []);

  const detectFaceLoop = async () => {
    if (!videoRef.current || !streamRef.current) return;
    
    setFaceStatusText('Loading AI Face Model...');
    let model = null;
    try {
      model = await loadBlazeFaceModel();
    } catch (err) {
      console.warn('[FaceScanner] BlazeFace load failed, trying native detector:', err);
    }

    // Native FaceDetector fallback if tfjs model failed
    const nativeDetector = (!model && window.FaceDetector)
      ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 })
      : null;

    if (!model && !nativeDetector) {
      setCameraError("Facial recognition engine could not be initialized. Please check internet connection.");
      setDetecting(false);
      return;
    }

    setFaceStatusText('Looking for your face...');

    let consecutiveFaceFrames = 0;

    const checkFace = async () => {
      if (!isCameraActiveRef.current || !videoRef.current) return;

      if (videoRef.current.readyState >= 2) {
        try {
          let faces = [];
          if (model) {
            faces = await model.estimateFaces(videoRef.current, false);
          } else if (nativeDetector) {
            faces = await nativeDetector.detect(videoRef.current);
          }

          if (faces && faces.length === 1) {
            const face = faces[0];
            let width = 0;
            let height = 0;
            let prob = 1;

            if (face.topLeft && face.bottomRight) {
              width = Math.abs(face.bottomRight[0] - face.topLeft[0]);
              height = Math.abs(face.bottomRight[1] - face.topLeft[1]);
              prob = Array.isArray(face.probability) ? face.probability[0] : (face.probability ?? 1);
            } else if (face.boundingBox) {
              width = face.boundingBox.width;
              height = face.boundingBox.height;
            }

            // Real Face Validation: confidence must be high, face size must be reasonable (not a speck or tiny reflection)
            if (prob >= 0.75 && width >= 45 && height >= 45) {
              consecutiveFaceFrames++;
              // Require 2 consecutive frames with confirmed face to avoid false flickers
              if (consecutiveFaceFrames >= 2) {
                setFaceDetected(true);
                setFaceStatusText('Face Detected & Verified');
                setDetecting(false);
              }
            } else {
              consecutiveFaceFrames = 0;
              setFaceDetected(false);
              setFaceStatusText('Move closer to the camera');
              setDetecting(true);
            }
          } else if (faces && faces.length > 1) {
            consecutiveFaceFrames = 0;
            setFaceDetected(false);
            setFaceStatusText('Multiple faces detected - only 1 person permitted');
            setDetecting(true);
          } else {
            consecutiveFaceFrames = 0;
            setFaceDetected(false);
            setFaceStatusText('No face detected - look into the camera');
            setDetecting(true);
          }
        } catch (e) {
          console.warn('[FaceScanner] Detection frame tick error:', e);
        }
      }

      if (isCameraActiveRef.current) {
        animFrameRef.current = requestAnimationFrame(checkFace);
      }
    };

    animFrameRef.current = requestAnimationFrame(checkFace);
  };

  useEffect(() => {
    if (isOpen) {
      setPhotoPreview(null);
      setBase64Image(null);
      setLocationState({ loading: false, address: null, error: null });
      setIsSubmitting(false);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, stopCamera]);

  const compressImage = (canvas) => {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    return dataUrl.split(',')[1];
  };

  const getAddressFromCoords = async (lat, lng) => {
    try {
      if (window.google && window.google.maps && window.google.maps.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response.results && response.results[0]) {
          return response.results[0].formatted_address;
        }
      } else {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
          const data = await res.json();
          if (data.results && data.results[0]) {
            return data.results[0].formatted_address;
          }
        }
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
    }
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await res.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    } catch (osmErr) {
      console.error("Geocoding with OSM failed:", osmErr);
    }
    
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    if (!faceDetected) {
      toast.error("Face not verified. Please look directly at the camera and align your face inside the circle.");
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    
    // Draw video frame to canvas with horizontal mirror
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // FINAL INTEGRITY CHECK: Verify the snapshot contains a real face before accepting!
    try {
      if (cachedBlazeFaceModel) {
        const checkFaces = await cachedBlazeFaceModel.estimateFaces(canvas, false);
        if (!checkFaces || checkFaces.length === 0) {
          toast.error("No face detected in the captured photo. Please look into the camera.");
          return;
        }
      }
    } catch (_) {}

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPhotoPreview(dataUrl);

    const base64 = compressImage(canvas);
    setBase64Image(base64);

    stopCamera();

    // Fetch location
    setLocationState({ loading: true, address: null, error: null });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const address = await getAddressFromCoords(latitude, longitude);
        setLocationState({ loading: false, address, error: null });
      },
      (err) => {
        const isLocalDev = typeof window !== 'undefined' && (
          window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1' || 
          Boolean(import.meta.env.DEV)
        );
        if (isLocalDev) {
          setLocationState({ loading: false, address: 'Indore, Madhya Pradesh (Demo)', error: null });
          return;
        }
        setLocationState({ loading: false, address: null, error: 'Location permission denied' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const retakePhoto = () => {
    setPhotoPreview(null);
    setBase64Image(null);
    startCamera();
  };

  const handleSubmit = async () => {
    if (!base64Image) return;
    setIsSubmitting(true);
    await onUpload(base64Image, locationState.address);
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { stopCamera(); onClose(); }} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/50">
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-orange-500" />
              <span>Verify Identity</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Real-time face verification &amp; location</p>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto flex flex-col items-center">
          {!photoPreview ? (
            <div className="flex flex-col items-center w-full">
              {cameraError ? (
                <div className="w-full h-64 border-2 border-dashed border-red-300 dark:border-red-800 rounded-2xl bg-red-50 dark:bg-red-950/40 flex flex-col items-center justify-center text-center p-4">
                  <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                  <p className="text-xs font-bold text-red-700 dark:text-red-300">{cameraError}</p>
                  <button onClick={startCamera} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold">Try Again</button>
                </div>
              ) : (
                <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden shadow-2xl border-4 border-gray-200 dark:border-zinc-700 bg-black">
                  <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  
                  {/* Face Guide Ring: Solid Green if Face Verified, Yellow Dashed if Scanning, Red if Multiple */}
                  <div className={`absolute inset-0 border-[5px] rounded-full transition-colors duration-300 ${
                    faceDetected 
                      ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' 
                      : 'border-amber-400 border-dashed animate-[spin_12s_linear_infinite]'
                  }`} />
                  
                  {/* Status Indicator inside camera */}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center px-2">
                    <div className={`px-3 py-1.5 rounded-full backdrop-blur-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-md ${
                      faceDetected 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-black/75 text-amber-300 border border-amber-400/40'
                    }`}>
                      {faceDetected ? (
                        <><CheckCircle2 className="w-3.5 h-3.5 text-white" /> <span>Face Verified</span></>
                      ) : (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" /> <span className="truncate max-w-[180px]">{faceStatusText}</span></>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-4 text-center space-y-1">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  {faceDetected ? 'Face Verified! Hold still & capture' : 'Align your face in the circle'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {faceDetected 
                    ? 'Ensure lighting is clear, then tap the button below.'
                    : 'The camera will only activate when an actual face is present.'}
                </p>
              </div>

              {/* Capture Button: STRICTLY disabled if no face detected! */}
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!faceDetected}
                className={`mt-5 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                  faceDetected 
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-500/30 cursor-pointer ring-4 ring-emerald-500/20' 
                    : 'bg-gray-200 dark:bg-zinc-800 cursor-not-allowed opacity-50'
                }`}
              >
                <Camera className={`w-7 h-7 ${faceDetected ? 'text-white' : 'text-gray-400'}`} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="relative w-56 h-56 mx-auto rounded-full overflow-hidden shadow-xl border-4 border-emerald-500 bg-black">
                <img src={photoPreview} alt="Selfie preview" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              {/* Location Verification Pill */}
              <div className="w-full bg-gray-50 dark:bg-zinc-800/80 p-3.5 rounded-2xl border border-gray-200 dark:border-zinc-700">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Verified Location</span>
                </div>
                {locationState.loading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Fetching GPS coordinates...</span>
                  </div>
                ) : locationState.error ? (
                  <p className="text-xs text-red-500 font-semibold">{locationState.error}</p>
                ) : (
                  <p className="text-xs text-gray-900 dark:text-white font-medium line-clamp-2">{locationState.address || 'Location captured'}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full pt-2">
                <button
                  type="button"
                  onClick={retakePhoto}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Retake Selfie
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || locationState.loading}
                  className="flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>Starting Shift...</span></>
                  ) : (
                    <span>Confirm &amp; Go Online</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
