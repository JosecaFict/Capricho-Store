package com.caprichostore.capricho_store

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseDetector
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import kotlin.math.atan2
import kotlin.math.sqrt

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.capricho.store/body_pose"
    private var poseDetector: PoseDetector? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // Inicializar detector de pose en modo SINGLE_IMAGE
        // Este modo es ultra eficiente (30-120 ms) y corre con total fluidez en gama baja, media y alta.
        val options = PoseDetectorOptions.Builder()
            .setDetectorMode(PoseDetectorOptions.SINGLE_IMAGE_MODE)
            .build()
        poseDetector = PoseDetection.getClient(options)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "detectPose") {
                val imagePath = call.argument<String>("imagePath")
                val gender = call.argument<String>("gender") ?: "HOMBRE"

                if (imagePath.isNullOrEmpty()) {
                    result.error("INVALID_ARGS", "Falta el parámetro imagePath", null)
                    return@setMethodCallHandler
                }

                analyzePose(imagePath, gender, result)
            } else {
                result.notImplemented()
            }
        }
    }

    private fun analyzePose(imagePath: String, gender: String, result: MethodChannel.Result) {
        val file = File(imagePath)
        if (!file.exists()) {
            result.success(
                mapOf(
                    "detected" to false,
                    "reason" to "FILE_NOT_FOUND",
                    "message" to "No se encontró el archivo de captura."
                )
            )
            return
        }

        try {
            // Decodificación adaptativa: Se calcula el factor de escala antes de cargar en RAM
            // para que fotos de alta resolución (ej. 64MP en Poco X3 o 108MP en S21 Ultra)
            // nunca excedan 1280px, protegiendo dispositivos de gama baja (2-3 GB RAM) contra OutOfMemory.
            val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(imagePath, boundsOptions)

            val maxDimension = 1280
            var sampleSize = 1
            while (boundsOptions.outWidth / sampleSize > maxDimension || boundsOptions.outHeight / sampleSize > maxDimension) {
                sampleSize *= 2
            }

            val decodeOptions = BitmapFactory.Options().apply {
                inSampleSize = sampleSize
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }

            var bitmap = BitmapFactory.decodeFile(imagePath, decodeOptions)
            if (bitmap == null) {
                result.success(
                    mapOf(
                        "detected" to false,
                        "reason" to "DECODE_ERROR",
                        "message" to "No se pudo procesar la imagen de la cámara."
                    )
                )
                return
            }

            // Corrección de rotación EXIF nativa según la orientación de la cámara
            val exif = ExifInterface(imagePath)
            val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            val rotationDegrees = when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }

            if (rotationDegrees != 0f) {
                val matrix = Matrix().apply { postRotate(rotationDegrees) }
                val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
                if (rotated != bitmap) {
                    bitmap.recycle()
                    bitmap = rotated
                }
            }

            val inputImage = InputImage.fromBitmap(bitmap, 0)
            poseDetector?.process(inputImage)
                ?.addOnSuccessListener { pose ->
                    val leftShoulder = pose.getPoseLandmark(PoseLandmark.LEFT_SHOULDER)
                    val rightShoulder = pose.getPoseLandmark(PoseLandmark.RIGHT_SHOULDER)

                    if (leftShoulder == null || rightShoulder == null ||
                        leftShoulder.inFrameLikelihood < 0.30f || rightShoulder.inFrameLikelihood < 0.30f) {
                        result.success(
                            mapOf(
                                "detected" to false,
                                "reason" to "SHOULDERS_NOT_VISIBLE",
                                "message" to "No se distinguen claramente ambos hombros. Asegúrate de estar de pie y erguido frente a la cámara."
                            )
                        )
                        bitmap.recycle()
                        return@addOnSuccessListener
                    }

                    val imageWidth = bitmap.width.toDouble()
                    val imageHeight = bitmap.height.toDouble()

                    // Coordenadas normalizadas [0.0 - 1.0]
                    val lx = leftShoulder.position.x / imageWidth
                    val ly = leftShoulder.position.y / imageHeight
                    val rx = rightShoulder.position.x / imageWidth
                    val ry = rightShoulder.position.y / imageHeight

                    val dx = (rx - lx) * imageWidth
                    val dy = (ry - ly) * imageHeight
                    val shoulderPixelDist = sqrt(dx * dx + dy * dy)
                    val shoulderRatio = shoulderPixelDist / imageWidth

                    // Ángulo de inclinación de hombros en grados
                    val angleDeg = Math.toDegrees(atan2(dy, dx))

                    // Centro del cuello: punto medio entre hombros ligeramente elevado
                    val neckX = (lx + rx) / 2.0
                    val neckY = ((ly + ry) / 2.0) - (0.04 * (if (imageHeight > imageWidth) 1.0 else 1.3))

                    // Estimación antropométrica calibrada por género (~1.7m de distancia)
                    val isFemale = gender.equals("MUJER", ignoreCase = true)
                    val baseFactor = if (isFemale) 92.0 else 102.0
                    val estimatedShouldersCm = (shoulderRatio * baseFactor).coerceIn(30.0, 62.0)

                    // Liberación inmediata de memoria RAM
                    bitmap.recycle()

                    result.success(
                        mapOf(
                            "detected" to true,
                            "estimatedShouldersCm" to estimatedShouldersCm,
                            "shoulderRatio" to shoulderRatio,
                            "shoulderAngle" to angleDeg,
                            "neck" to mapOf("x" to neckX, "y" to neckY),
                            "gender" to gender
                        )
                    )
                }
                ?.addOnFailureListener { e ->
                    bitmap.recycle()
                    result.success(
                        mapOf(
                            "detected" to false,
                            "reason" to "MLKIT_ERROR",
                            "message" to "Error al analizar la postura: ${e.localizedMessage}"
                        )
                    )
                }
        } catch (e: Throwable) {
            result.error("PROCESSING_EXCEPTION", e.localizedMessage, null)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        poseDetector?.close()
    }
}
