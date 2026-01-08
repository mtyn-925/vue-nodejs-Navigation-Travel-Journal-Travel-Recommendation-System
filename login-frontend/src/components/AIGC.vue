<template>
  <div class="generate-page">
    <div class="generate-container">
      <h1 class="page-title">生成旅游动画</h1>

      <!-- 文本描述 -->
      <textarea v-model="description" placeholder="请输入描述信息（如地点、感受等，最多300字）" maxlength="300" class="input-description"></textarea>

      <!-- 图片上传 -->
      <div class="upload-section">
        <label class="upload-label">上传图片 (最多上传9张)</label>
        <div class="image-preview">
          <div v-for="(img, index) in previewImages" :key="img + index" class="image-item">
            <img :src="img" alt="预览图" />
            <button class="delete-btn" @click.stop="removeImage(index)">×</button>
          </div>
          <label v-if="previewImages.length < 9" class="upload-button">
            +
            <input type="file" multiple @change="handleImageUpload" accept="image/*" />
          </label>
        </div>
      </div>

      <!-- ✅ 放在白框最下方 -->
      <div class="button-wrapper">
        <button @click="generateVideo" class="submit-button">生成动画</button>
      </div>
      <!-- ✅ 进度条 -->
<div v-if="isGenerating" class="progress-container">
  <p>⏳ 正在生成视频，请稍候...</p>
  <div class="progress-bar">
    <div class="progress-fill" :style="{ width: progress + '%' }"></div>
  </div>
  <p>{{ progress }}%</p>
</div>



    </div>
  </div>
</template>



<script>
export default {
  name: 'GenerateVideo',
  data() {
    return {
      description: '',
      images: [],
      previewImages: [],
      isGenerating: false,      // 是否正在生成
      videoUrl: null,           // 生成的视频链接
      progress: 0,  // ✅ 新增进度
      progressInterval: null,   // ✅ 进度条定时器
      
    };
  },
  methods: {
    handleImageUpload(event) {
      const files = Array.from(event.target.files);

      if (this.images.length + files.length > 9) {
        alert('最多只能上传9张图片');
        return;
      }

      files.forEach(file => {
        this.images.push(file);
        const reader = new FileReader();
        reader.onload = e => this.previewImages.push(e.target.result);
        reader.readAsDataURL(file);
      });
    },
    removeImage(index) {
      this.images.splice(index, 1);
      this.previewImages.splice(index, 1);
    },
    async generateVideo() {
  if (!this.description.trim()) {
    alert('请填写文字描述');
    return;
  }

  if (this.images.length < 1) {
    alert('请至少上传1张图片');
    return;
  }

  const formData = new FormData();
  formData.append('description', this.description);
  this.images.forEach(file => formData.append('images', file));

  this.isGenerating = true;
  this.videoUrl = null;
  this.progress = 0;

  // ✅ 开始进度模拟
  this.progressInterval = setInterval(() => {
    if (this.progress < 99) {
      this.progress += 1;
    }
  }, 300); // 每300ms 增加1%

  try {
    const res = await fetch('http://10.29.22.120:3000/api/gen-vlog', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('生成失败');

    const blob = await res.blob();
    this.videoUrl = URL.createObjectURL(blob);

    // ✅ 成功后，进度跳满 + 播放
    this.progress = 100;
    clearInterval(this.progressInterval);

    this.$nextTick(() => {
      alert('🎉 视频生成成功！点击确定播放');
      window.open(this.videoUrl, '_blank');
    });
  } catch (err) {
    console.error('生成失败:', err);
    alert('生成失败，请稍后再试');
    clearInterval(this.progressInterval);
  } finally {
    this.isGenerating = false;
  }
}


  }
};

</script>

<style scoped>
.generate-page {
  padding: 20px;
  display: flex;
  justify-content: center;
}

.generate-container {
  width: 1300px;
  height: 720px;
  background: #ffffff;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  color: #f312e4;
  text-align: center;
  margin-bottom: 20px;
}

.input-description {
  width: 100%;
  height: 120px;
  font-size: 16px;
  padding: 10px;
  margin-bottom: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  resize: none;
}

.upload-section {
  margin-bottom: 20px;
}

.upload-label {
  font-weight: bold;
  margin-bottom: 10px;
  display: block;
  color: #333;
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
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.1);
}

.upload-button {
  width: 120px;
  height: 120px;
  background-color: #fafafa;
  border: 2px dashed #ccc;
  border-radius: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 32px;
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

.submit-button {
  width: 100%;
  padding: 12px;
  font-size: 18px;
  background-color: #f312e4;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}

.submit-button:hover {
  background-color: #254b9e;
}
.generate-page {
  padding: 20px;
  display: flex;
  justify-content: center;
}

.generate-container {
  width: 1300px;
  min-height: 700px;
  background: #ffffff;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  justify-content: space-between; /* 保证按钮在底部 */
}

.button-wrapper {
  margin-top: auto;
  padding-top: 20px;
}

.submit-button {
  width: 100%;
  padding: 14px;
  font-size: 18px;
  background-color: #f312e4;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}

.submit-button:hover {
  background-color: #c10ccc;
}

.progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255,255,255,0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.progress-box {
  width: 60%;
  background-color: #f0f0f0;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.progress-bar {
  height: 20px;
  width: 0%;
  background-color: #f312e4;
  border-radius: 10px;
  transition: width 0.4s ease;
}

.progress-text {
  margin-top: 10px;
  color: #333;
  font-weight: bold;
}
.progress-container {
  margin-top: 20px;
  text-align: center;
}

.progress-bar {
  width: 80%;
  height: 14px;
  background-color: #e0e0e0;
  border-radius: 10px;
  margin: 10px auto;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #f312e4;
  transition: width 0.3s ease;
}


</style>
