<template>
  <div class="ai-page">
    <div class="ai-container">

      <!-- 文生图区域 -->
      <section class="ai-card">
        <h1 class="ai-title">🖋️ 文生图生成</h1>
        <textarea v-model="textToImagePrompt" placeholder="请输入描述，如“天安门日落全景图”" class="ai-textarea"></textarea>
        <button @click="generateImage" :disabled="loadingImage" class="ai-button">
          {{ loadingImage ? '生成中...' : '立即生成图片' }}
        </button>
        <div v-if="generatedImage" class="ai-preview">
          <img :src="generatedImage" alt="生成图" class="ai-image" @click="openPreview(generatedImage)" />
        </div>
      </section>

      <!-- 图生图区域 -->
      <section class="ai-card">
        <h1 class="ai-title">🖼️ 图生图生成</h1>
        <textarea v-model="textToImg2ImgPrompt" placeholder="请输入描述，如“添加梦幻滤镜效果”" class="ai-textarea"></textarea>
        <div class="upload-section">
          <label class="upload-label">上传原始图片 (只能上传1张)</label>
          <div class="image-preview">
            <div v-for="(img, index) in img2imgPreview" :key="index" class="image-item">
              <img :src="img" alt="预览图" />
              <button class="delete-btn" @click="removeImg2Img(index)">×</button>
            </div>
            <label v-if="img2imgFiles.length < 1" class="upload-button">
              +
              <input type="file" @change="handleImg2ImgUpload" accept="image/*" />
            </label>
          </div>
        </div>
        <button @click="generateImg2Img" :disabled="loadingImg2Img" class="ai-button">
          {{ loadingImg2Img ? '生成中...' : '图生图生成' }}
        </button>
        <div v-if="generatedImg2Img" class="ai-preview">
          <img :src="generatedImg2Img" alt="图生图结果" class="ai-image" @click="openPreview(generatedImg2Img)" />
        </div>
      </section>

    </div>
  </div>
  <!-- 弹出大图预览 -->
<div v-if="showPreview" class="preview-overlay" @click="closePreview">
  <img :src="previewSrc" class="preview-image" />
</div>

</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

// 文生图
const textToImagePrompt = ref('')
const generatedImage = ref(null)
const loadingImage = ref(false)
const showPreview = ref(false)
const previewSrc = ref('')

const openPreview = (src) => {
  previewSrc.value = src
  showPreview.value = true
}

const closePreview = () => {
  showPreview.value = false
}


const generateImage = async () => {
  if (!textToImagePrompt.value) {
    alert('请填写文字描述')
    return
  }
  loadingImage.value = true
  generatedImage.value = null
  try {
    const res = await axios.post('/api/gen-image', { prompt: textToImagePrompt.value })
    generatedImage.value = `http://localhost:3000${res.data.image_url}`
  } catch (err) {
    alert('图片生成失败')
  } finally {
    loadingImage.value = false
  }
}

// 图生图
const textToImg2ImgPrompt = ref('')
const img2imgFiles = ref([])
const img2imgPreview = ref([])
const loadingImg2Img = ref(false)
const generatedImg2Img = ref(null)

const handleImg2ImgUpload = (e) => {
  const files = Array.from(e.target.files)
  if (img2imgFiles.value.length + files.length > 1) {
    alert('只能上传1张图片')
    return
  }
  files.forEach(file => {
    img2imgFiles.value.push(file)
    const reader = new FileReader()
    reader.onload = (event) => img2imgPreview.value.push(event.target.result)
    reader.readAsDataURL(file)
  })
}

const removeImg2Img = (index) => {
  img2imgFiles.value.splice(index, 1)
  img2imgPreview.value.splice(index, 1)
}

const generateImg2Img = async () => {
  if (!textToImg2ImgPrompt.value || img2imgFiles.value.length === 0) {
    alert('请填写描述并上传图片')
    return
  }

  loadingImg2Img.value = true
  generatedImg2Img.value = null
  const formData = new FormData()
  formData.append('description', textToImg2ImgPrompt.value)
  formData.append('image', img2imgFiles.value[0])

  try {
    const res = await axios.post('/api/img2img', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    generatedImg2Img.value = `http://localhost:3000${res.data.image_url}`
  } catch (err) {
    alert('图生图失败')
  } finally {
    loadingImg2Img.value = false
  }
}
</script>

<style scoped>
.ai-page {
  padding: 40px;
  background: #fafafa;
  min-height: 100vh;
  display: flex;
  justify-content: center;
}
.ai-container {
  width: 100%;
  max-width: 1300px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}
.ai-card {
  background: #ffffff;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
}
.ai-title {
  font-size: 22px;
  font-weight: bold;
  color: #f312e4;
  margin-bottom: 16px;
}
.ai-textarea {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 1px solid #ddd;
  border-radius: 12px;
  resize: none;
}
.ai-button {
  margin-top: 16px;
  background-color: #f312e4;
  color: white;
  border: none;
  padding: 12px 24px;
  font-size: 16px;
  border-radius: 12px;
  cursor: pointer;
}
.ai-button:hover {
  background-color: #c10ccc;
}
.ai-preview {
  margin-top: 20px;
  text-align: center;
}
.ai-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 12px;
}
.upload-section {
  margin-top: 20px;
}
.upload-label {
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 8px;
}
.image-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.image-item {
  position: relative;
}
.image-item img {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 10px;
  box-shadow: 0 0 6px rgba(0,0,0,0.1);
}
.upload-button {
  width: 120px;
  height: 120px;
  background-color: #fafafa;
  border: 2px dashed #ccc;
  border-radius: 10px;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  cursor: pointer;
  position: relative;
}
.upload-button input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.delete-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: #ff4d4f;
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  cursor: pointer;
}

.preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 16px;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.3);
  transition: transform 0.3s;
}
.preview-image:hover {
  transform: scale(1.01);
}

</style>
