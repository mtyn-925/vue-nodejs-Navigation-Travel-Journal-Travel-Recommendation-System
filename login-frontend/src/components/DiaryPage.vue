  <template>
    <div class="diary-page">
      <div class="header-bar">
        <h1 class="page-title">旅游日记</h1>
        
        <div class="user-center">
        </div>
      </div>
      <!-- 搜索框 -->
<div class="search-bar">
  <input 
    v-model="searchQuery" 
    type="text" 
    class="search-input" 
    placeholder="搜索日记..." 
  />
  <select v-model="searchType" class="search-select">
    <option value="content">搜内容</option>
    <option value="title">搜标题</option>
    <option value="destination">搜目的地</option> 
  </select>
   <button class="search-btn" @click="searchDiaries">搜索</button>
</div>


      <!-- 排序选择框 -->
      <div class="sort-options">
        <label for="sort">排序方式: </label>
        <select v-model="sortOption" @change="sortDiaries">
          <option value="hybrid">综合排序</option>
          <option value="heat">按热度排序</option>
          <option value="rating">按评分排序</option>
          
        </select>
      </div>
      
      <div class="diary-list">

        <div v-for="diary in diaries" :key="diary.id" class="diary-item" @click="openDiary(diary)">
          <!-- 删除按钮放封面右上角 -->
          <button v-if="isAdmin" class="delete-button" @click.stop="deleteDiary(diary.id)">
            <img src="@/assets/image/delete.jpg" alt="删除" class="delete-icon" />
          </button>
          <div class="diary-header">
            <h2>{{ diary.title }}</h2>
            <p class="content">{{ diary.content.length > 12 ? diary.content.slice(0, 12) + '...' : diary.content }}</p>
          </div>
          

          <div class="animated-cover" @click="triggerAnimation($event)">

  <div v-if="diary.video_url && diary.video_url !== 'null' && diary.video_url !== '' && diary.video_url !== undefined" class="video">
    <video :src="fixVideoUrl(diary.video_url)" class="diary-video" muted autoplay loop playsinline></video>
  </div>
  <div v-else-if="diary.images && safeParseImages(diary.images).length > 0" class="cover-image">
    <img 
      :src="fixImageUrl(safeParseImages(diary.images)[0])" 
      alt="封面图" 
      class="cover-img" 
    />
  </div>
</div>

           <div class="heat">
  <div class="meta-top">
    <span class="date">{{ formatDate(diary.created_at) }}</span>
    <span class="rating">
      <span v-for="n in Math.floor(diary.rating)" :key="n" class="star filled">★</span>
      <span v-if="diary.rating % 1 >= 0.5" class="star half-filled">★</span>
      <span v-for="n in 5 - Math.floor(diary.rating) - (diary.rating % 1 >= 0.5 ? 1 : 0)" :key="n + 'empty'" class="star empty">★</span>
    </span>
  </div>
  <div class="meta-bottom">
    <span>热度：{{ diary.heat }} 浏览</span>
    <span class="publisher">发布者: {{ diary.publisher_name }}</span>
  </div>
  <div class="destination-text">
    {{ diary.destination ? '目的地：' + diary.destination : '目的地：暂无' }}
  </div>
</div>


        </div>
      </div>

      <!-- 弹窗 -->
      <div v-if="showModal" class="modal-overlay" @click="closeModal">
  <div 
class="modal-content"
    :class="{ 'modal-animate': showModal }" 
    @click.stop
  >
  <button class="close-button" @click="closeModal">×</button>
    <h2>{{ selectedDiary.title }}</h2>
    <p>{{ selectedDiary.content }}</p>

    <!-- 图片展示 -->
    <div v-if="selectedDiary.images && selectedDiary.images.length" class="modal-images">
      <img 
        v-for="(image, index) in safeParseImages(selectedDiary.images)" 
        :key="index" 
        :src="fixImageUrl(image)" 
        alt="详情图" 
        class="detail-img"
      />
    </div>

    <!-- 视频展示 -->
    <div v-if="selectedDiary.video_url && selectedDiary.video_url !== 'null' && selectedDiary.video_url !== '' && selectedDiary.video_url !== undefined" class="video">
      <video :src="fixVideoUrl(selectedDiary.video_url)" controls class="diary-video" />
    </div>

    <!-- 当前评分 -->
    <div class="rating">
      <label>当前评分: </label>
      <span v-for="n in Math.floor(selectedDiary.rating)" :key="n" class="star filled">★</span>
      <span v-if="selectedDiary.rating % 1 >= 0.5" class="star half-filled">★</span>
      <span v-for="n in 5 - Math.floor(selectedDiary.rating) - (selectedDiary.rating % 1 >= 0.5 ? 1 : 0)" :key="n + 'empty'" class="star empty">★</span>
    </div>

    <!-- 我的评分 -->
    <div class="my-rating">
      <label>我的评分: </label>
      <select v-model="myRating" @change="ratingChanged" :disabled="!isEditingRating && hasRated">
        <option value="1">1</option>
        <option value="1.5">1.5</option>
        <option value="2">2</option>
        <option value="2.5">2.5</option>
        <option value="3">3</option>
        <option value="3.5">3.5</option>
        <option value="4">4</option>
        <option value="4.5">4.5</option>
        <option value="5">5</option>
      </select>
    </div>

    <!-- 按钮 -->
<div class="modal-buttons">
  <button v-if="myRating !== null" @click="isEditingRating ? submitRating() : toggleEditRating()">
    {{ isEditingRating ? '提交评分' : '修改评分' }}
  </button>
  <button @click="openComment">写评论</button>
</div>

<!-- 评论输入框 -->
<div v-if="showCommentInput" class="comment-input">
  <textarea v-model="newComment" placeholder="输入你的评论..." rows="4"></textarea>
  <button @click="submitComment">提交评论</button>
</div>

<!-- 切换 评论区 / 推荐区 -->
<div class="switch-tabs">
  <button 
    :class="{ active: activeTab === 'recommendations' }" 
    @click="activeTab = 'recommendations'"
  >
    推荐区
  </button>
  <button 
  :class="{ active: activeTab === 'comments' }" 
  @click="activeTab = 'comments'"
>
  评论区（ {{ comments.length }} ）
</button>

</div>


<!-- 评论列表展示 -->
<div class="comment-list">
  <h3>
  {{ activeTab === 'comments' ? `评论区（${comments.length}条）` : '推荐区' }}
</h3>


  <div v-if="activeTab === 'comments'">
    <div v-if="comments.length === 0" class="no-comments">
      当前暂无评论
    </div>
    <div v-else>
      <div v-for="(cmt, index) in comments" :key="index" class="comment-item">
        <template v-if="cmt.avatar">
          <img 
            :src="fixImageUrl(cmt.avatar)" 
            alt="头像" 
            class="comment-avatar"
          />
        </template>
        <template v-else>
          <div class="comment-avatar" style="display:flex;justify-content:center;align-items:center;font-size:20px;background:#ccc;">
            👤
          </div>
        </template>

        <div class="comment-content">
          <div class="comment-header">
            <span class="comment-username">{{ cmt.username }}</span>
            <span class="comment-time">{{ formatDate(cmt.created_at) }}</span>
          </div>
          <div class="comment-text">{{ cmt.comment }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 推荐区内容 -->
  <div v-else>
  <div v-if="recommendations.length === 0" class="no-comments">
    暂无推荐
  </div>
  <div v-else>
    <div v-for="(rec, index) in recommendations" 
         :key="index" 
         class="recommend-item"
         @click="openDiaryFromRecommendation(rec)"
    >
      <img :src="fixImageUrl(safeParseImages(rec.images)[0])" alt="封面" class="recommend-cover" />
      <div class="recommend-info">
        <div class="recommend-title">{{ rec.title }}</div>
        <div class="recommend-meta">
          <span>{{ rec.publisher_name }}</span> · 
          <span>{{ rec.heat }}浏览</span> · 
          <span>{{ rec.comment_count || 0 }}评论</span>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- 推荐区内容结束 -->
</div>  

        </div>
      </div>
    </div>
    
  </template>

  <script>
  import axios from 'axios';

  export default {
    data() {
      return {
        diaries: [],
        users: [],
        showModal: false,
        selectedDiary: {},
        sortOption: 'hybrid',
        myRating: null,
        hasRated: false,
        isEditingRating: false, // ✅ 新增：控制是否允许修改评分
        showUserCenter: false,
        username: localStorage.getItem('username') || '未登录',
        searchQuery: '',    // 🔥 新增 搜索关键词
        searchType: 'content', // 🔥 新增 搜索类型，默认搜内容
        showCommentInput: false,
        newComment: '',
        comments: [], // 🔥 新增评论列表
        activeTab: 'recommendations',  // 🔥 当前激活的tab，默认是评论区
        recommendations: [],    // 🔥 推荐的日记列表
        isAdmin: localStorage.getItem('isAdmin') === 'true',

      };
    },
    mounted() {
      this.sortDiaries();
    },
    methods: {
      /* 删除日记 */
      async deleteDiary(id) {
        if (!confirm('确定要删除这篇日记吗？')) return;
        try {
          await axios.delete(`http://localhost:3000/api/diary/${id}`);
          alert('删除成功');
          this.sortDiaries(); // 刷新列表
        } catch (err) {
          console.error('删除失败:', err);
          alert('删除失败');
        }
      },

      
/* 打开推荐日记 */
      async openDiaryFromRecommendation(diary) {
  this.selectedDiary = diary;
  this.showModal = true;

  // 🔥 等待DOM更新完再滚动到顶部
  this.$nextTick(() => {
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
      modalContent.scrollTop = 0; 
    }
  });

  await this.fetchComments(diary.id);

  try {
    const userId = localStorage.getItem('user_id');
    const res = await axios.get(`http://localhost:3000/api/diary/ratings/${diary.id}/${userId}`);
    this.myRating = res.data.myRating || null;
    this.hasRated = this.myRating !== null;
    this.isEditingRating = !this.hasRated;
  } catch (error) {
    console.error('获取用户评分失败:', error);
    this.myRating = null;
    this.hasRated = false;
    this.isEditingRating = true;
  }

  try {
    await axios.post('http://localhost:3000/api/diary/heat', { diary_id: diary.id });
    diary.heat++;
    this.sortDiaries();
  } catch (error) {
    console.error('增加浏览量时出错:', error);
  }
},
/* 打开推荐日记结束 */
      async fetchRecommendations() {
  try {
    const res = await axios.get(`http://localhost:3000/api/diaries/recommend`, {
      params: {
        diary_id: this.selectedDiary.id
      }
    });
    this.recommendations = res.data;
  } catch (error) {
    console.error('获取推荐失败:', error);
    this.recommendations = [];
  }
},

      //搜索函数
      async searchDiaries(resetPage = true) {
  if (resetPage) {
    this.page = 1;
    this.diaries = []; // ✨ 清空已有数据
  }

  const keyword = this.searchQuery.trim();
  if (!keyword) {
    // 没有关键词，按当前排序方式加载
    await this.loadBySort();
    return;
  }

  // 选择接口路径
  let apiUrl = '';
  if (this.searchType === 'title') {
    apiUrl = 'http://localhost:3000/api/diaries/hash-search'; // 哈希表查标题
  }
  else if (this.searchType === 'destination')  {
    apiUrl = 'http://localhost:3000/api/diaries/search-by-destination'; 
  } 
  else {
    apiUrl = 'http://localhost:3000/api/diaries/inverted-search'; // 倒排索引查内容
  }

  try {
    const res = await axios.get(apiUrl, {
      params: {
        keyword: keyword,
        sortOption: this.sortOption
      }
    });
    this.diaries = res.data;
  } catch (error) {
    console.error('搜索日记失败:', error);
  }
},
//热度，评分，综合排序
async loadBySort() {
  try {
    const res = await axios.get('http://localhost:3000/api/diaries/sorted', {
      params: {
        sort: this.sortOption
      }
    });
    this.diaries = res.data;
  } catch (error) {
    console.error('加载日记失败:', error);
  }
},



      triggerAnimation(event) {
  console.log('点击了封面', event);
},
      // 解析images字段（防止JSON解析出错）
  safeParseImages(images) {
  if (Array.isArray(images)) {
    // 本来就是数组
    return images;
  }
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      return [images]; // 不是JSON格式，直接当字符串
    }
  }
  return []; // 其它情况，返回空数组
},


  // 补全图片链接地址
  fixImageUrl(path) {
  if (!path) return '';
  path = String(path);  // 👉 加这一行，保证path是字符串
  if (path.startsWith('http')) {
    return path;
  }
  return `http://localhost:3000${path}`;
},
fixVideoUrl(path) {
  if (!path) return '';
  path = String(path);
  if (path.startsWith('http')) {
    return path;
  }
  return `http://localhost:3000${path}`;  // 不是localhost:8080，是后端ip和端口
},


      async getDiaries() {
  try {
    const res = await axios.get('http://localhost:3000/api/diaries');
    this.diaries = res.data;
  } catch (error) {
    console.error('获取日记数据时出错:', error);
  }
},

      async openDiary(diary) {
  this.selectedDiary = diary;
  this.showModal = true;
  await this.fetchComments(diary.id);
  await this.fetchRecommendations();

  try {
    const userId = localStorage.getItem('user_id');
    const res = await axios.get(`http://localhost:3000/api/diary/ratings/${diary.id}/${userId}`);
    this.myRating = res.data.myRating || null;
    this.hasRated = this.myRating !== null;
    this.isEditingRating = !this.hasRated;
  } catch (error) {
    console.error('获取用户评分失败:', error);
    this.myRating = null;
    this.hasRated = false;
    this.isEditingRating = true;
  }

  try {
    await axios.post('http://localhost:3000/api/diary/heat', { diary_id: diary.id });

    // ✅ 实时同步到当前显示的 selectedDiary 中（弹窗立即生效）
    this.selectedDiary.heat += 1;

    // ✅ 重新加载排序后的日记列表（实时刷新列表）
    await this.sortDiaries();

  } catch (error) {
    console.error('增加浏览量时出错:', error);
  }
},


      async submitRating() {
        const userId = localStorage.getItem('user_id');
        if (!userId) {
          alert("请先登录再评分！");
          return;
        }

        if (this.myRating !== null) {
          try {
            await axios.post('http://localhost:3000/api/diary/ratings', {
              diary_id: this.selectedDiary.id,
              user_id: userId,
              rating: this.myRating,
            });
            await this.sortDiaries();
            this.hasRated = true;
            this.isEditingRating = false; // ✅ 提交后关闭编辑状态
          } catch (error) {
            console.error('提交评分失败:', error);
          }
        }
      },
      toggleEditRating() {
        this.isEditingRating = true;
        this.hasRated = false;
      },
      closeModal() {
        this.showModal = false;
        this.selectedDiary = {};
        this.isEditingRating = false;
      },
      formatDate(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      },
      async sortDiaries() {
  this.page = 1;
  this.diaries = [];
  
  if (this.searchQuery.trim()) {
    // 🔥 如果有搜索关键词，就重新搜索（带新的排序方式）
    await this.searchDiaries(false); 
  } else {
    // 没关键词，正常按照当前排序加载
    await this.loadBySort();
  }
},



      openComment() {
  this.showCommentInput = true;
},

async submitComment() {
  if (!this.newComment.trim()) {
    alert('评论不能为空！');
    return;
  }

  const userId = localStorage.getItem('user_id');
  if (!userId) {
    alert('请先登录再评论！');
    return;
  }

  try {
    await axios.post('http://localhost:3000/api/diary/comments', {
      diary_id: this.selectedDiary.id,
      user_id: userId,
      comment: this.newComment,
    });
    alert('评论提交成功！');
    this.newComment = '';
    this.showCommentInput = false;
     // ✨🔥 新增：提交后立即重新获取评论列表
    await this.fetchComments(this.selectedDiary.id);
  } catch (error) {
    console.error('评论提交失败:', error);
    alert('提交失败');
  }
},
/* 评论 */
    async fetchComments(diaryId) {
  try {
    const res = await axios.get(`http://localhost:3000/api/diary/comments/${diaryId}`);
    this.comments = res.data;
  } catch (error) {
    console.error('获取评论失败:', error);
    this.comments = [];
  }
},




    }
  };
  </script>


  <style scoped>
  /* 日记页面样式 */
  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .user-center {
    position: relative;
  }

  .user-center button {
    background-color: #f312e4;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 5px;
    cursor: pointer;
  }
  .diary-page {
    padding: 20px;
  }

  .page-title {
    font-size: 2rem;
    padding-left: 620px;
    margin-bottom: 20px;
    color: #e08d8d;
  }

  .diary-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); /* 卡片宽度280px，你可以改成300px、260px随意 */
  gap: 16px; /* 卡片之间的间距 */
  justify-content: center; /* 居中排列 */
}

.diary-item {
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  cursor: pointer;
  width: 280px; /* ✅ 固定宽度（和上面grid设置对应） */
  height: 400px; /* ✅ 固定高度（可以自己调大调小，比如420px） */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
  transition: all 0.3s ease; /* 加点悬停动画 */
  position: relative;  /* ✅ 使内部绝对定位的按钮以它为参照 */
}

.diary-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

  

  .diary-item h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #333;
  }

  



  .date {
    font-style: italic;
  }

  .rating {
    color: #f39c12;
  }

  .star {
    margin-right: 2px;
  }

  /* 满星的样式 */
  .filled {
    color: #f39c12;
  }

  /* 半颗星的样式 */
  .half-filled {
    background: linear-gradient(to right, #f39c12 50%, #ccc 50%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* 空星的样式：灰色或透明 */
  .empty {
    color: #ccc;
  }

  .publisher {
    margin-left: 10px;
  }

  .content {
    font-size: 1rem;
    color: #555;
    margin-bottom: 10px;
  }
/* ====== 外面列表页封面小图样式 ====== */
.cover-image {
  display: flex;
  align-items: flex-start;
}

.cover-img {
  width: 240px; /* ✅ 封面图自己手动调整大小，比如120px */
  height: 240px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}

/* ====== 弹窗里面的大图样式 ====== */
.modal-images {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* ✅ 三列布局 */
  gap: 10px; /* 间距适中 */
  margin-top: 15px;
  width: 100%;
}

.detail-img {
  width: 100%;
  aspect-ratio: 1/1; /* 保持正方形 */
  object-fit: cover; /* 填满而不变形 */
  border-radius: 10px;
  display: block;
}
  .video {
    margin-top: 10px;
    border-radius: 8px;
    overflow: hidden;
  }

  .diary-video {
    width: 100%;
    height: auto;
  }

  .heat {
  display: flex;
  flex-direction: column;
  gap: 4px; /* 两行之间间隔 */
  margin-top: auto; /* 让它靠底部 */
  font-size: 0.85rem;
  color: #888;
}
.destination-text {
  font-size: 0.8rem;
  color: #aaa;
}


.meta-top,
.meta-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meta-top {
  font-size: 0.8rem;
  color: #aaa;
}

.meta-bottom {
  font-size: 0.8rem;
  color: #aaa;
}


  /* 弹窗样式 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 80%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative; /* ✅ 重要：让close-button参照这个定位 */
}


  button {
    padding: 10px;
    background-color: #f39c12;
    border: none;
    color: white;
    cursor: pointer;
    border-radius: 5px;
  }

  /* 我的评分选择框 */
  .my-rating {
    margin-top: 10px;
  }

  select {
    padding: 5px;
  }
  
  /* 动画效果 */
  .modal-animate {
  animation: scaleModal 0.7s ease forwards;/* 点击动画快慢 */
}

@keyframes scaleModal {
  0% {
    transform: scale(0.7);
    opacity: 0.5;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
/* 搜索栏样式 */
.search-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
  gap: 10px;
}

.search-input {
  width: 600px;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 16px;
}

.search-select {
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
  font-size: 16px;
  cursor: pointer;
}
/* 评论 */
.modal-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.comment-input {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.comment-input textarea {
  width: 100%;
  padding: 8px;
  border-radius: 5px;
  border: 1px solid #ccc;
  resize: none;
}

.close-button {
  position: sticky; /* ✅ 关键是sticky */
  top: 10px;
  float: right; /* ✅ 向右对齐 */
  background: transparent;
  border: none;
  font-size: 30px;
  cursor: pointer;
  color: #666;
  z-index: 100; /* 保证在内容上面 */
}

.close-button:hover {
  color: #f39c12;
}



/* 评论区 */

.no-comments {
  text-align: center;
  color: #aaa;
  font-size: 16px;
  margin-top: 10px;
}


.comment-list {
  margin-top: 20px;
  border-top: 1px solid #ddd;
  padding-top: 10px;
}

.comment-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 15px;
}

.comment-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 10px;
}

.comment-content {
  flex: 1;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #666;
}

.comment-username {
  font-weight: bold;
  color: #333;
}

.comment-time {
  font-size: 12px;
  color: #aaa;
}

.comment-text {
  margin-top: 4px;
  font-size: 15px;
  color: #444;
}

/* 切换按钮 */
.switch-tabs {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin: 20px 0;
  background: rgba(255, 255, 255, 0.6); /* 半透明白色 */
  padding: 8px;
  border-radius: 10px;
}

.switch-tabs button {
  background: transparent;
  border: none;
  font-size: 18px;
  color: #555;
  padding: 6px 12px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.switch-tabs button.active {
  background: white;
  color: #f39c12;
  font-weight: bold;
  box-shadow: 0 0 8px rgba(0,0,0,0.1);
}

/* 推荐区 */
.recommend-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
  width: 100%;         /* 占满 */
  max-width: 600px;    /* ✅每条最大宽500px（可以自己改更大，比如600px） */
  
}


.recommend-cover {
  width: 150px;   /* ✅图片宽度 */
  height: 120px;   /* ✅图片高度 */
  object-fit: cover;
  border-radius: 6px;
}



.recommend-item:hover {
  background: #f9f9f9;
}

.recommend-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recommend-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommend-meta {
  font-size: 12px;
  color: #999;
}
/* 推荐区结束 */

/* 删除按钮 */
.delete-button {
  position: absolute;
  top: 27px;
  right: 8px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  z-index: 10;
}

.delete-icon {
  width: 35px;
  height: 35px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 4px rgba(0,0,0,0.2);
}
/* 删除按钮结束 */

/* 搜索按钮 */
.search-btn {
  padding: 8px 16px;
  background-color: #d9708f;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}
.search-btn:hover {
  background-color: #df60a4;
}

  </style>
