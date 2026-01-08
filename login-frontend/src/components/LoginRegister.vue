<template>
  <div class="box">
    <!-- 欢迎区域 -->
    <div class="pre-box" :style="{ transform: preBoxTransform, backgroundColor: preBoxColor }">
      <h1>欢迎登陆</h1>
      <p>BUPT导航系统!</p>
      <div class="img-box">
        <img :src="imageSrc" alt="欢迎图片" />
      </div>
    </div>

    <!-- 注册表单 -->
    <div class="register-form">
      <div class="title-box"><h1>注册</h1></div>
      <div class="input-box">
        <input v-model="regUsername" placeholder="用户名" />
        <input type="password" v-model="regPassword" placeholder="密码" />
        <input type="password" v-model="regConfirmPassword" placeholder="确认密码" />
      </div>
      <div class="btn-box">
        <button @click="register">注册</button>
        <p @click="switchForm">已有账号?去登录</p>
      </div>
    </div>

    <!-- 登录表单 -->
    <div class="login-form">
      <div class="title-box"><h1>登录</h1></div>
      <div class="input-box">
        <input v-model="loginUsername" placeholder="用户名" />
        <input type="password" v-model="loginPassword" placeholder="密码" />
      </div>
      <div class="btn-box">
        <button @click="login">登录</button>
        <p @click="switchForm">没有账号?去注册</p>
      </div>
    </div>
  </div>
</template>

<script scoped>
import axios from 'axios';

export default {
  data() {
    return {
      flag: true,
      imageSrc: require('@/assets/image/dieq.jpg'),
      preBoxTransform: 'translateX(0%)',
      preBoxColor: '#edd4e7',

      // 表单数据
      regUsername: '',
      regPassword: '',
      regConfirmPassword: '',
      loginUsername: '',
      loginPassword: ''
    };
  },
  methods: {
    switchForm() {
      this.flag = !this.flag;
      this.preBoxTransform = this.flag ? 'translateX(0%)' : 'translateX(100%)';
      this.preBoxColor = this.flag ? '#edd4e7' : '#c9e0ed';
      this.imageSrc = this.flag
        ? require('@/assets/image/dieq.jpg')
        : require('@/assets/image/diew.jpg');
    },

    // 注册功能
    register() {
      if (!this.regUsername || !this.regPassword || !this.regConfirmPassword) {
        alert('用户名和密码不能为空！');
        return;
      }

      if (this.regPassword !== this.regConfirmPassword) {
        alert('两次输入的密码不一致！');
        return;
      }

      axios.post('http://localhost:3000/register', {
        username: this.regUsername,
        password: this.regPassword
      })
      .then(res => {
        alert(res.data); // 注册成功
        this.switchForm();
      })
      .catch(err => {
        alert(err.response?.data || '注册失败！');
      });
    },

    // 登录功能
    login() {
      if (!this.loginUsername || !this.loginPassword) {
        alert('用户名和密码不能为空！');
        return;
      }

      axios.post('http://localhost:3000/login', {
        username: this.loginUsername,
        password: this.loginPassword
      })
      .then(res => {
        const { message, user_id, is_admin } = res.data; 
        if (message === '登录成功') {
          alert('登录成功！'); // ✅ 弹窗提示
          localStorage.setItem('username', this.loginUsername);
          localStorage.setItem('user_id', user_id);
          localStorage.setItem('isAdmin', is_admin ? 'true' : 'false'); // ✅ 设置 isAdmin
          this.$router.push({ name: 'diary' });
        } else {
          alert(message);
        }
      })
      .catch(err => {
        alert(err.response?.data || '登录失败！');
      });
    }
  }
};
</script>

<style>
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  overflow-x: hidden;
  background: #f4e1f7 !important;
  background: rgb(244, 225, 247) !important;
}
</style>

<style scoped>
.box {
  width: 1050px;
  height: 600px;
  display: flex;
  position: relative;
  align-items: flex-end;
  justify-content: space-between;
  z-index: 2;
  margin: 60px auto;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 2px 1px 19px rgba(0, 0, 0, 0.1);
  background: linear-gradient(to right, rgb(238, 209, 247), rgb(191, 191, 241));
}

.pre-box {
  width: 50%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  z-index: 99;
  border-radius: 4px;
  background-color: #edd4e7;
  box-shadow: 2px 1px 19px rgba(0, 0, 0, 0.1);
  transition: 0.5s ease-in-out;
}

.pre-box h1 {
  margin-top: 150px;
  text-align: center;
  letter-spacing: 5px;
  color: white;
  user-select: none;
  text-shadow: 4px 4px 3px rgba(0, 0, 0, 0.1);
}

.pre-box p {
  height: 30px;
  line-height: 30px;
  text-align: center;
  margin: 20px 0;
  user-select: none;
  font-weight: bold;
  color: white;
  text-shadow: 4px 4px 3px rgba(0, 0, 0, 0.1);
}

.img-box {
  width: 200px;
  height: 200px;
  margin: 20px auto;
  border-radius: 50%;
  user-select: none;
  overflow: hidden;
  box-shadow: 4px 4px 3px rgba(0, 0, 0, 0.1);
}

.img-box img {
  width: 100%;
  transition: 0.5s;
}

.login-form {
  flex: 1;
  height: 100%;
  margin-top: -30px;
}

.register-form {
  flex: 1;
  height: 100%;
  margin-top: -60px;
}

.title-box {
  height: 300px;
  line-height: 500px;
}

.title-box h1 {
  text-align: center;
  color: white;
  user-select: none;
  letter-spacing: 5px;
  text-shadow: 4px 4px 3px rgba(0, 0, 0, 0.1);
}

.input-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

input {
  width: 60%;
  height: 40px;
  margin-bottom: 20px;
  text-indent: 10px;
  border: 1px solid #fff;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 120px;
  backdrop-filter: blur(10px);
  outline: none;
}

input:focus {
  color: #b0cfe9;
}

input:focus::placeholder {
  opacity: 0;
}

.btn-box {
  display: flex;
  justify-content: center;
}

button {
  width: 100px;
  height: 30px;
  margin: 0 7px;
  line-height: 30px;
  border: none;
  border-radius: 4px;
  background-color: #9f69f0;
  color: white;
}

button:hover {
  cursor: pointer;
  opacity: 0.8;
}

.btn-box p {
  height: 30px;
  line-height: 30px;
  user-select: none;
  font-size: 14px;
  color: white;
  margin-top: -1px;
}

.btn-box p:hover {
  cursor: pointer;
  border-bottom: 1px solid white;
}
</style>