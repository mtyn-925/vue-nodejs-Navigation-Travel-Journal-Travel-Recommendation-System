  <template>
    <div class="publish-page">
      <div class="publish-container">
        <h1 class="page-title">发布新日记</h1>

        <!-- 标题输入 -->
        <input v-model="title" type="text" placeholder="请输入标题(最多输入9个字)" maxlength="9"  class="input-title" />
        <!-- 旅游目的地输入 -->
        <input v-model="destination" type="text" placeholder="请输入旅游目的地（不超过15个字）" maxlength="15" class="input-title" />



        <!-- 内容输入 -->
        <textarea v-model="content" placeholder="请输入内容...(最多输入3000个字)" maxlength="3000" class="input-content"></textarea>

        <!-- 图片上传 -->
        <div class="upload-section">
          <label class="upload-label">上传图片 (最多9张)</label>
          <div class="image-preview">
            <div v-for="(img, index) in previewImages" :key="img + index" class="image-item">
              <img :src="img" alt="预览图" />
              <!-- 删除按钮 -->
              <button class="delete-btn" @click.stop="removeImage(index)">×</button>
            </div>
            <label v-if="previewImages.length < 9" class="upload-button">
              +
              <input type="file" multiple @change="handleImageUpload" accept="image/*" />
            </label>
          </div>
        </div>

        <!-- 视频上传 -->
        <div class="upload-section">
          <label class="upload-label">上传视频 (可选)</label>
          <div class="video-preview">
            <div v-if="previewVideo" class="video-container">
              <video :src="previewVideo" controls></video>
              <!-- 删除按钮 -->
              <button class="delete-btn" @click.stop="removeVideo()">×</button>
            </div>
            <label v-else class="upload-button">
              +
              <input type="file" @change="handleVideoUpload" accept="video/*" />
            </label>
          </div>
        </div>

        <!-- 发布按钮 -->
        <button @click="submitDiary" class="submit-button">发布日记</button>
      </div>
    </div>
  </template>

  <script>
  import axios from 'axios';

  export default {
    name: 'PublishDiary',
    data() {
      return {
        title: '',
        content: '',
        images: [],
        previewImages: [],
        video: null,
        previewVideo: null,
        userId: localStorage.getItem('user_id'), // 记得拿user_id
        destination: '',
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
          this.images.push(file); // 上传用真实文件
          const reader = new FileReader();
          reader.onload = (e) => {
            this.previewImages.push(e.target.result); // 预览用base64
          };
          reader.readAsDataURL(file);
        });
      },
      handleVideoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.video = file;
        const reader = new FileReader();
        reader.onload = (e) => {
          this.previewVideo = e.target.result;
        };
        reader.readAsDataURL(file);
      },
      removeImage(index) {
        this.images.splice(index, 1);
        this.previewImages.splice(index, 1);
      },
      removeVideo() {
        this.video = null;
        this.previewVideo = null;
      },
      async submitDiary() {
        if (!this.title || !this.content) {
          alert('标题和内容不能为空');
          return;
        }
        if (this.images.length === 0 && !this.video) {
      alert('请至少上传一张图片或一个视频');
      return;
    }

        const formData = new FormData();
        formData.append('user_id', this.userId);
        formData.append('title', this.title);
        formData.append('content', this.content);
        formData.append('destination', this.destination);

        this.images.forEach(file => {
          formData.append('images', file);
        });

        if (this.video) {
          formData.append('video', this.video);
        }

        try {
          await axios.post('http://localhost:3000/api/diaries/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          alert('发布成功！');
          this.$router.push('/diary');
        } catch (error) {
          console.error('发布失败:', error);
          alert('发布失败，请稍后重试');
        }
      },
      /** 🔥 新加的安全解析函数 */
      safeParseImages(images) {
        try {
          const parsed = JSON.parse(images);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return images ? [images] : [];
        }
      }
    }
  };
  </script>



  <style scoped>
  /* 页面整体 */
  .publish-page {
    padding: 20px;
    display: flex;
    justify-content: center;
  }

  .publish-container {
    width: 1300px;
    background: #ffffff;
    padding: 20px;
    border-radius: 16px;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
  }

  /* 标题 */
  .page-title {
    font-size: 24px;
    font-weight: bold;
    color: #f312e4;
    text-align: center;
    margin-bottom: 20px;
  }

  /* 输入框 */
  .input-title {
    width: 100%;
    font-size: 18px;
    padding: 10px;
    margin-bottom: 15px;
    border: 1px solid #ccc;
    border-radius: 8px;
  }

  .input-content {
    width: 100%;
    height: 150px;
    font-size: 16px;
    padding: 10px;
    margin-bottom: 20px;
    border: 1px solid #ccc;
    border-radius: 8px;
    resize: none;
  }

  /* 上传区域 */
  .upload-section {
    margin-bottom: 20px;
  }

  .upload-label {
    font-weight: bold;
    margin-bottom: 10px;
    display: block;
    color: #333;
  }

  /* 图片预览 */
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

  /* 上传按钮样式 */
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

  /* 删除按钮 */
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

  /* 视频预览 */
  .video-preview {
    width: 100%;
    text-align: center;
  }

  .video-container {
    position: relative;
    display: inline-block;
  }

  .video-preview video {
    width: 100%;
    border-radius: 10px;
    margin-top: 10px;
  }

  /* 发布按钮 */
  .submit-button {
    width: 10%;
    padding: 12px;
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
  </style> 