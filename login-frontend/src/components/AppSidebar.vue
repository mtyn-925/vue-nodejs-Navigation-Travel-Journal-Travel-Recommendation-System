<template>
  <div class="sidebar">
    <div class="sidebar-content">
      <!-- 头像+用户名 -->
      <div class="sidebar-item user-info" @click="openAvatarModal">
  <div class="avatar-wrapper">
    <img v-if="avatarUrl" :src="avatarUrl" alt="头像" class="avatar-img" />
    <span v-else class="default-avatar">👤</span>
  </div>
 <span class="username-text">{{ username }}</span>

</div>
<div><span class="username-text" v-if="isAdmin">（管理员账户）</span></div>


      <router-link to="/diary" class="sidebar-item">日记查看</router-link>
      <router-link to="/publish" class="sidebar-item">日记发布</router-link>
      <router-link to="/recommend" class="sidebar-item">旅游推荐</router-link>
      <router-link to="/map" class="sidebar-item">地图导航</router-link>
      <router-link to="/AIGC" class="sidebar-item">图生视频</router-link>
      <router-link to="/AJPG" class="sidebar-item">文生图</router-link>

    </div>

    <router-link to="/" class="sidebar-item logout">退出登录</router-link>

    <!-- 头像上传弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click="closeAvatarModal">
      <div class="modal-content" @click.stop>
        <h3>修改密码</h3>
<div class="password-change">
  <input v-model="oldPassword" type="password" placeholder="旧密码" />
  <input v-model="newPassword" type="password" placeholder="新密码" />
  <input v-model="confirmPassword" type="password" placeholder="确认新密码" />
  <button @click="changePassword">修改密码</button>
</div>
        <h3>修改头像</h3>

<div class="file-upload">
  <input type="file" @change="handleFileChange" accept="image/*" />
</div>

<div v-if="previewUrl" class="preview">
  <img :src="previewUrl" alt="预览头像" />
</div>
<button @click="uploadAvatar">上传</button>
<button @click="closeAvatarModal">取消</button>

        

      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'AppSidebar',
  data() {
    return {
      username: localStorage.getItem('username') || '未登录',
      userId: localStorage.getItem('user_id') || null,
      avatarUrl: '', // 保存头像URL
      showModal: false,
      selectedFile: null,
      previewUrl: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
      isAdmin: localStorage.getItem('isAdmin') === 'true',
    };
  },
  mounted() {
    this.fetchAvatar();
  },
  methods: {
    //改密码
    
    openAvatarModal() {
      if (!this.userId) {
        alert("请先登录！");
        return;
      }
      this.showModal = true;
    },
    closeAvatarModal() {
      this.showModal = false;
      this.selectedFile = null;
      this.previewUrl = '';
    },
    handleFileChange(event) {
      const file = event.target.files[0];
      if (file) {
        this.selectedFile = file;
        this.previewUrl = URL.createObjectURL(file);
      }
    },
    async uploadAvatar() {
      if (!this.selectedFile) {
        alert('请先选择文件！');
        return;
      }
      const formData = new FormData();
      formData.append('avatar', this.selectedFile);
      formData.append('user_id', this.userId);

      try {
        const res = await axios.post('http://localhost:3000/api/user/upload-avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        this.avatarUrl = 'http://localhost:3000' + res.data.avatarUrl; // 注意补完整路径
        this.closeAvatarModal();
        alert('头像上传成功！');
      } catch (error) {
        console.error('头像上传失败:', error);
        alert('上传失败');
      }
    },
    async fetchAvatar() {
      if (!this.userId) return;
      try {
        const res = await axios.get(`http://localhost:3000/api/user/avatar/${this.userId}`);
        if (res.data.avatar) {
          this.avatarUrl = 'http://localhost:3000' + res.data.avatar;
        }
      } catch (error) {
        console.error('获取头像失败:', error);
      }
    },
    //改密码
    async changePassword() {
    if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
      alert("请填写完整！");
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      alert("两次输入的新密码不一致！");
      return;
    }

    try {
      await axios.post('http://localhost:3000/api/user/change-password', {
        user_id: this.userId,
        oldPassword: this.oldPassword,
        newPassword: this.newPassword,
      });
      alert("密码修改成功，请重新登录！");
      localStorage.clear(); // 清空登录信息
      this.$router.push('/'); // 返回登录页
    } catch (error) {
      console.error('修改密码失败:', error);
      alert(error.response.data || "密码修改失败");
    }
  }

  }
};
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 140px;
  height: 100%;
  background-color: #caa0a083;
  padding: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sidebar-item {
  text-decoration: none;
  color: white;
  font-size: 18px;
  padding: 10px;
  border-radius: 5px;
  transition: background-color 0.3s ease;
}

.sidebar-item:hover {
  background-color: #8f5c5c;
  cursor: pointer;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px; /* 头像和名字之间间距 */
  cursor: pointer;
}

.avatar-wrapper {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  background: #ccc;
  display: flex;
  justify-content: center;
  align-items: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.default-avatar {
  font-size: 24px;
}

.username-text {
  font-size: 16px;
  color: white;
  white-space: nowrap;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 300px;
  text-align: center;
}

.preview img {
  width: 100px;
  height: 100px;
  margin-top: 10px;
  border-radius: 50%;
  object-fit: cover;
}

button {
  margin: 10px;
  padding: 8px 16px;
  background-color: #f39c12;
  border: none;
  border-radius: 5px;
  color: white;
  cursor: pointer;
}
/*修改密码部分*/
.password-change {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.file-upload {
  width: 100%; /* 填满弹窗宽度 */
  display: flex;
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中（对齐input内部） */
  margin: 10px 0;
}

.file-upload input[type="file"] {
  width: 80%; /* ✅ 输入框本身也拉宽一点，不要小小一个 */
  padding: 6px;
  font-size: 14px;
}



.password-change input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.password-change button {
  margin-top: 10px;
  background-color: #007bff;
}
.logout {
  margin-top: auto;
  margin-bottom: 30px;
  background-color: #d9534f;
  text-align: center;
  border-radius: 5px;
}

.logout:hover {
  background-color: #c9302c;
}

</style>
