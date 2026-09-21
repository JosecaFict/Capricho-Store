import Flutter
import UIKit
import Vision

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var poseChannel: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let appResult = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    
    // Registrar el canal de pose mediante el plugin registrar oficial
    if poseChannel == nil,
       let registrar = self.registrar(forPlugin: "CaprichoBodyPosePlugin") {
      registerPoseChannel(messenger: registrar.messenger())
    } else if let controller = window?.rootViewController as? FlutterViewController, poseChannel == nil {
      registerPoseChannel(messenger: controller.binaryMessenger)
    }
    
    return appResult
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    
    if poseChannel == nil,
       let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "CaprichoBodyPosePlugin") {
      registerPoseChannel(messenger: registrar.messenger())
    }
  }

  private func registerPoseChannel(messenger: FlutterBinaryMessenger) {
    guard poseChannel == nil else { return }
    let channel = FlutterMethodChannel(
      name: "com.capricho.store/body_pose",
      binaryMessenger: messenger
    )
    
    channel.setMethodCallHandler({ [weak self] (call: FlutterMethodCall, result: @escaping FlutterResult) -> Void in
      if call.method == "detectPose" {
        guard let args = call.arguments as? [String: Any],
              let imagePath = args["imagePath"] as? String else {
          result(FlutterError(code: "INVALID_ARGS", message: "Falta imagePath", details: nil))
          return
        }
        let gender = args["gender"] as? String ?? "HOMBRE"
        self?.analyzePose(imagePath: imagePath, gender: gender, result: result)
      } else {
        result(FlutterMethodNotImplemented)
      }
    })
    
    self.poseChannel = channel
  }

  private func analyzePose(imagePath: String, gender: String, result: @escaping FlutterResult) {
    let fileURL = URL(fileURLWithPath: imagePath)
    guard FileManager.default.fileExists(atPath: imagePath) else {
      result([
        "detected": false,
        "reason": "FILE_NOT_FOUND",
        "message": "No se encontró el archivo de captura."
      ])
      return
    }

    if #available(iOS 14.0, *) {
      let request = VNDetectHumanBodyPoseRequest()
      let handler = VNImageRequestHandler(url: fileURL, options: [:])
      
      do {
        try handler.perform([request])
        guard let observation = request.results?.first else {
          result([
            "detected": false,
            "reason": "NO_BODY_FOUND",
            "message": "No se detectó una persona frente a la cámara. Colócate de pie erguido a ~1.7 metros."
          ])
          return
        }
        
        let recognizedPoints = try observation.recognizedPoints(.all)
        guard let leftShoulder = recognizedPoints[.leftShoulder], leftShoulder.confidence > 0.50,
              let rightShoulder = recognizedPoints[.rightShoulder], rightShoulder.confidence > 0.50 else {
          result([
            "detected": false,
            "reason": "SHOULDERS_NOT_VISIBLE",
            "message": "Hombros no detectados con claridad. Por favor párate de pie y de frente a la cámara a ~1.7 metros."
          ])
          return
        }
        
        let leftEye = recognizedPoints[.leftEye]
        let rightEye = recognizedPoints[.rightEye]
        let nose = recognizedPoints[.nose]
        
        // Filtro Anti-Fantasmas Estricto: Exigir rostro visible mirando al frente
        let hasFace = (nose != nil && nose!.confidence > 0.45) ||
                      (leftEye != nil && leftEye!.confidence > 0.45) ||
                      (rightEye != nil && rightEye!.confidence > 0.45)
        if !hasFace {
          result([
            "detected": false,
            "reason": "NO_FACE_FOUND",
            "message": "No se detectó un rostro de frente. Por favor párate de pie erguido mirando a la cámara a ~1.7 metros."
          ])
          return
        }
        
        // Coordenadas normalizadas (0.0 a 1.0)
        // En Apple Vision, Y=0 está abajo; invertimos Y para que coincida con Flutter (Y=0 arriba)
        let lsX = Double(leftShoulder.location.x)
        let lsY = Double(1.0 - leftShoulder.location.y)
        let rsX = Double(rightShoulder.location.x)
        let rsY = Double(1.0 - rightShoulder.location.y)
        
        let dx = abs(rsX - lsX)
        let dy = abs(rsY - lsY)
        let shoulderDist = sqrt(dx * dx + dy * dy)
        let shoulderAngle = atan2(rsY - lsY, rsX - lsX)
        
        // Validar inclinación: hombros excesivamente desnivelados (cuerpo de lado o acostado)
        if dy > dx || (shoulderDist > 0 && (dy / shoulderDist) > 0.38) {
          result([
            "detected": false,
            "reason": "BODY_TILTED",
            "message": "Cuerpo inclinado de lado. Por favor mantén el torso erguido y ambos hombros nivelados."
          ])
          return
        }
        
        // Validar que la cabeza esté arriba de los hombros
        var neckX = (lsX + rsX) / 2.0
        var neckY = (lsY + rsY) / 2.0
        let avgShoulderY = (lsY + rsY) / 2.0
        
        if let neck = recognizedPoints[.neck], neck.confidence > 0.30 {
          neckX = Double(neck.location.x)
          neckY = Double(1.0 - neck.location.y)
          if neckY > avgShoulderY + 0.06 {
            result([
              "detected": false,
              "reason": "POSTURE_INVALID",
              "message": "Postura no reconocida. Mantén tu torso erguido mirando a la cámara."
            ])
            return
          }
        }
        
        // Estimar distancia física real a partir de la relación de encuadre en iPhone
        let estimatedDistanceMeters = Double(round((0.48 / max(shoulderDist, 0.08)) * 10) / 10)
        
        // Validar distancia razonable: no muy lejos (>2.4m) ni muy cerca (<1.2m)
        if shoulderDist < 0.15 {
          result([
            "detected": false,
            "reason": "TOO_FAR",
            "message": "Estás demasiado lejos (~" + String(format: "%.1f", estimatedDistanceMeters) + "m). Acércate a ~1.7 metros para medir con precisión."
          ])
          return
        }
        
        if shoulderDist > 0.48 {
          result([
            "detected": false,
            "reason": "TOO_CLOSE",
            "message": "Estás demasiado cerca. Da un paso atrás para encuadrar tu torso a ~1.7 metros."
          ])
          return
        }
        
        // --- CÁLCULO ANTROPOMÉTRICO ROBUSTO DIFERENCIADO POR GÉNERO ---
        let isFemale = gender.uppercased() == "MUJER"
        let baseCm = isFemale ? 36.0 : 47.0
        let refIpd = isFemale ? 6.0 : 6.35
        let refHeadH = isFemale ? 14.5 : 16.5
        let minRange = isFemale ? 32.0 : 38.0
        let maxRange = isFemale ? 48.0 : 56.0

        // Factor de expansión deltoidea anatómica (de articulación ósea a borde exterior)
        let deltoidExpansion = isFemale ? 1.15 : 1.25

        // Compensación óptica por distancia: mantiene invariante el cálculo en cm
        // tanto a 1.4m como a 2.1m
        let distanceComp = (estimatedDistanceMeters / 1.70).clamped(to: 0.85...1.20)

        var estimatedCm: Double = baseCm
        var estimationMethod = "calibrated_fov"
        
        // 1. Método Interpupilar: Invariante a distancia
        if let le = leftEye, le.confidence > 0.35,
           let re = rightEye, re.confidence > 0.35 {
          let eyeDx = abs(Double(le.location.x) - Double(re.location.x))
          let eyeDy = abs(Double(le.location.y) - Double(re.location.y))
          let eyeDist = sqrt(eyeDx * eyeDx + eyeDy * eyeDy)
          if eyeDist > 0.015 {
            let anthropometricScale = refIpd / eyeDist
            let rawCm = shoulderDist * anthropometricScale * deltoidExpansion
            if rawCm >= minRange && rawCm <= maxRange {
              estimatedCm = rawCm
              estimationMethod = "interpupillary_ratio"
            }
          }
        }
        
        // 2. Método Nariz-Cuello: Invariante a distancia
        if estimationMethod == "calibrated_fov" {
          if let n = nose, n.confidence > 0.35,
             let neck = recognizedPoints[.neck], neck.confidence > 0.30 {
            let headDy = abs(Double(n.location.y) - Double(neck.location.y))
            if headDy > 0.035 {
              let headScale = refHeadH / headDy
              let rawHeadCm = shoulderDist * headScale * deltoidExpansion
              if rawHeadCm >= minRange && rawHeadCm <= maxRange {
                estimatedCm = rawHeadCm
                estimationMethod = "head_height_ratio"
              }
            }
          }
        }
        
        // 3. Método FOV Calibrado compensado por distancia métrica (168 cm campo hombre / 148 cm campo mujer a 1.70m)
        if estimationMethod == "calibrated_fov" {
          let fovFactor = (isFemale ? 148.0 : 168.0) * distanceComp
          estimatedCm = (shoulderDist * fovFactor).clamped(to: minRange...maxRange)
        }
        
        // Redondear a 1 decimal y limitar al rango humano real según género
        let finalCm = Double(round(estimatedCm * 10) / 10).clamped(to: minRange...maxRange)
        
        result([
          "detected": true,
          "shoulderRatio": shoulderDist,
          "shoulderAngle": shoulderAngle,
          "estimatedShouldersCm": finalCm,
          "estimatedDistanceMeters": estimatedDistanceMeters,
          "gender": isFemale ? "MUJER" : "HOMBRE",
          "method": estimationMethod,
          "leftShoulder": ["x": lsX, "y": lsY, "confidence": Double(leftShoulder.confidence)],
          "rightShoulder": ["x": rsX, "y": rsY, "confidence": Double(rightShoulder.confidence)],
          "neck": ["x": neckX, "y": neckY],
          "confidence": Double((leftShoulder.confidence + rightShoulder.confidence) / 2.0)
        ])
      } catch {
        result([
          "detected": false,
          "reason": "VISION_ERROR",
          "message": "Error analizando postura con Apple Vision: \(error.localizedDescription)"
        ])
      }
    } else {
      result([
        "detected": false,
        "reason": "UNSUPPORTED_IOS",
        "message": "Requiere iOS 14 o superior para Apple Vision"
      ])
    }
  }
}

private extension Comparable {
  func clamped(to limits: ClosedRange<Self>) -> Self {
    return min(max(self, limits.lowerBound), limits.upperBound)
  }
}
