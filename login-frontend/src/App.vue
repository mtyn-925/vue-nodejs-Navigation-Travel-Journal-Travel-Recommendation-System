<template>
  <div id="app">
    <!-- 判断当前路由是否为 LoginRegister 页面，如果是则不显示侧边栏 -->
    <AppSidebar v-if="showSidebar" />
    <!-- 主内容区域，根据侧边栏是否显示动态调整位置 -->
    <div id="main-content" :style="{ marginLeft: showSidebar ? '180px' : '0', paddingTop: '0px', transition: 'margin-left 0s ease' }">
      <router-view></router-view>  <!-- 这里会根据路由显示不同的组件 -->
    </div>
  </div>
</template>

<script>
import AppSidebar from './components/AppSidebar.vue';

export default {
  name: 'App',
  components: {
    AppSidebar,
  },
  computed: {
    showSidebar() {
      // 获取当前路由的路径
      const path = this.$route.path;
      // 如果路径是 '/' (登录页面)，则不显示侧边栏
      return path !== '/';
    },
  },
};
</script>

<style scoped>
#app {
  position: relative;
  display: flex; /* 使用 flexbox 来确保主内容区域与侧边栏布局不互相影响 */
  height: 100vh; /* 确保容器高度占满整个屏幕 */
}

#main-content {
  flex: 1; /* 主内容区域占满剩余空间 */
  padding: 20px;
  transition: margin-left 0.3s ease; /* 平滑过渡效果 */
  padding-top: 20px; /* 调整顶部空间，防止内容被遮挡 */
}
</style>
