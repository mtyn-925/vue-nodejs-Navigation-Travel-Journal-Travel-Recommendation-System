// 引入模块
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');


/*函数开始*/
// 自定义哈希表 & 倒排索引
let titleHashTable = {};    // key: 标题，value: diary
let invertedIndex = {};     // key: 单词，value: Set of diary IDs
let diaryList = [];         // 所有解压后的日记（用于后续搜索结果返回）
// 读取所有日记，构建哈希表和倒排索引
function getNGrams(text, n = 2) {
  const grams = [];
  for (let i = 0; i <= text.length - n; i++) {
    grams.push(text.slice(i, i + n));
  }
  return grams;
}


// 读取所有日记，构建哈希表和倒排索引
function buildCustomIndexes(rawDiaries) {
  titleHashTable = {};
  invertedIndex = {};
  diaryList = decodeDiaries(rawDiaries);

  for (const diary of diaryList) {
    const title = diary.title;
    const content = diary.content || '';
    const text = `${title} ${content}`.toLowerCase();

    // 哈希表构建：将 value 设为数组
    const titleKey = title.toLowerCase().trim(); // 👈 加这一行
    if (!titleHashTable[title]) {
      titleHashTable[title] = [];
    }
    titleHashTable[title].push(diary);


    // 倒排索引构建
    const cleanText = text.replace(/\s+/g, '');
    const grams2 = getNGrams(cleanText, 2);
    const grams1 = cleanText.split(''); // 单个字符

    const allGrams = [...grams2, ...grams1];

    for (const gram of allGrams) {
      if (!gram) continue;
      if (!invertedIndex[gram]) invertedIndex[gram] = new Set();
      invertedIndex[gram].add(diary.id);
    }


  }
}

// 哈夫曼编码
// 构建频率表
function buildFrequencyMap(text) {
  const map = {};
  for (const ch of text) {
    map[ch] = (map[ch] || 0) + 1;
  }
  return map;
}
// 构建哈夫曼树
function buildHuffmanTree(freqMap) {
  const nodes = Object.entries(freqMap).map(([char, freq]) => ({ char, freq }));
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    const left = nodes.shift();
    const right = nodes.shift();
    nodes.push({
      left,
      right,
      freq: left.freq + right.freq,
    });
  }
  return nodes[0];
}
// 构建哈夫曼编码表
function buildCodes(tree, prefix = '', codeMap = {}) {
  if (!tree.left && !tree.right) {
    codeMap[tree.char] = prefix || '0'; // 单字符特例
  } else {
    if (tree.left) buildCodes(tree.left, prefix + '0', codeMap);
    if (tree.right) buildCodes(tree.right, prefix + '1', codeMap);
  }
  return codeMap;
}
// 压缩函数
function compress(text) {
  const freqMap = buildFrequencyMap(text);
  const tree = buildHuffmanTree(freqMap);

  // 特殊处理：只有一个字符
  if (!tree.left && !tree.right) {
    const onlyChar = tree.char;
    return {
      binary: '0'.repeat(text.length),  // 全是'0'
      tree: JSON.stringify({ char: onlyChar })  // 简化树结构
    };
  }

  const codeMap = buildCodes(tree);
  const binary = [...text].map(ch => codeMap[ch]).join('');

  function serializeTree(node) {
    if (!node.left && !node.right) return { char: node.char };
    return {
      left: serializeTree(node.left),
      right: serializeTree(node.right),
    };
  }

  return {
    binary,
    tree: JSON.stringify(serializeTree(tree))
  };
}
// 解压函数
function parseTree(treeStr) {
  try {
    return JSON.parse(treeStr);
  } catch (e) {
    console.error('❌ 哈夫曼树 JSON 解析失败:', e);
    return null;
  }
}
// 解压函数
function decompressHuffman(binaryStr, tree) {
  // 特殊处理：只有一个字符，tree 是 { char: 'a' }
  if (!tree.left && !tree.right && tree.char !== undefined) {
    return tree.char.repeat(binaryStr.length);
  }

  let result = '';
  let node = tree;

  for (let bit of binaryStr) {
    node = bit === '0' ? node.left : node.right;
    if (node.char !== undefined) {
      result += node.char;
      node = tree;
    }
  }

  return result;
}
// 解压日记数组：用于统一批量解码 content 字段
function decodeDiaries(arr) {
  return arr.map(d => {
    if (d.content && d.huffman_tree) {
      const tree = parseTree(d.huffman_tree);
      if (tree) {
        d.content = decompressHuffman(d.content, tree);
      }
    }
    return d;
  });
}
/*模糊匹配目的地*/
function fuzzyScore(keyword, target) {
  keyword = keyword.trim().toLowerCase();
  target = target.trim().toLowerCase();

  // 完全包含 => 满分
  if (target.includes(keyword)) return 100;

  // 提前剪枝：如果目标长度与关键词差距过大，就直接丢弃
  if (Math.abs(keyword.length - target.length) > 2) return 0;

  // 字符匹配数（顺序不敏感）
  let matchCount = 0;
  for (let i = 0; i < keyword.length; i++) {
    if (target.includes(keyword[i])) matchCount++;
  }
  const containScore = Math.floor((matchCount / keyword.length) * 70);

  // 编辑距离
  let diffCount = 0;
  const minLen = Math.min(keyword.length, target.length);
  for (let i = 0; i < minLen; i++) {
    if (keyword[i] !== target[i]) diffCount++;
  }
  diffCount += Math.abs(keyword.length - target.length);
  const editScore = Math.max(0, 60 - diffCount * 15); // 每错一个扣15分

  // 关键词和目标字符重合度过低也直接判0
  if (matchCount < Math.floor(keyword.length / 2)) return 0;

  return Math.max(containScore, editScore);
}



/*函数结束*/


// 创建应用
const app = express();
const port = 3000;
const ip = '0.0.0.0'; // 监听所有IP，包括localhost和局域网IP

// 中间件
app.use(cors({ origin: '*' }));
app.use(express.json());

//路由
const jingdian = require('./routes/jingdian');
app.use('/jingdian', jingdian);
const daohang = require('./routes/daohang');
app.use('/daohang', daohang);


// 连接数据库
const db = mysql.createConnection({
  host: '192.168.0.101',// 10.29.22.120
  user: 'caiyoujian',
  password: '123456',
  database: 'travel_login'
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ MySQL连接成功');

  db.query('SELECT * FROM diaries', (err, results) => {
    if (!err) {
      buildCustomIndexes(results);
      console.log('✅ 自定义索引构建完成');
    } else {
      console.error('❌ 构建索引失败:', err);
    }
  });
  db.query('SELECT * FROM diaries', (err, results) => {
    if (!err) buildCustomIndexes(results);
    else console.error('❌ 构建索引失败:', err);
  });
});


// 保证上传目录存在
const diaryUploadPath = path.join(__dirname, 'uploads', 'diaries');
const avatarUploadPath = path.join(__dirname, 'uploads', 'avatars');

if (!fs.existsSync(diaryUploadPath)) fs.mkdirSync(diaryUploadPath, { recursive: true });
if (!fs.existsSync(avatarUploadPath)) fs.mkdirSync(avatarUploadPath, { recursive: true });

const generatedPath = path.join(__dirname, 'uploads', 'generated');
if (!fs.existsSync(generatedPath)) fs.mkdirSync(generatedPath, { recursive: true });


// Multer配置
const diaryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, diaryUploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarUploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const diaryUpload = multer({ storage: diaryStorage });
const avatarUpload = multer({ storage: avatarStorage });

// 静态托管uploads目录
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

console.log('✅ 文件上传路径已准备好');

// ================== 接口开始 ==================

// 注册接口
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("用户名或密码为空");

  const hashedPassword = await bcrypt.hash(password, 10);
  db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).send("用户名已存在");
      return res.status(500).send("注册失败");
    }
    res.send("注册成功");
  });
});

// 登录接口
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("用户名或密码为空");

  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) return res.status(500).send("查询失败");
    if (results.length === 0) return res.status(400).send("用户不存在");

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      res.json({
        message: "登录成功",
        user_id: user.id,
        is_admin: user.is_admin === 1, // 返回 is_admin 字段，1 为管理员，0 为普通用户
      });
    } else {
      res.status(400).send("密码错误");
    }
  });
});



//修改密码接口
app.post('/api/user/change-password', (req, res) => {
  const { user_id, oldPassword, newPassword } = req.body;
  if (!user_id || !oldPassword || !newPassword) {
    return res.status(400).send("缺少字段");
  }

  db.query('SELECT password FROM users WHERE id = ?', [user_id], async (err, results) => {
    if (err) return res.status(500).send('服务器错误');
    if (results.length === 0) return res.status(404).send('用户不存在');

    const user = results[0];
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) {
      return res.status(400).send('旧密码错误');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    db.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, user_id], (err2) => {
      if (err2) return res.status(500).send('密码更新失败');
      res.send('密码修改成功');
    });
  });
});




// 获取所有旅游日记
app.get('/api/diaries', (req, res) => {
  db.query(`
    SELECT diaries.*, users.username AS publisher_name
    FROM diaries
    JOIN users ON diaries.user_id = users.id
  `, (err, results) => {
    if (err) return res.status(500).send("获取日记失败");

    // 解压 content 字段
    const decoded = results.map(d => {
      if (d.content && d.huffman_tree) {
        const tree = parseTree(d.huffman_tree);
        if (tree) {
          d.content = decompressHuffman(d.content, tree);
        }
      }
      return d;
    });

    res.json(decoded);
  });
});

// 发布旅游日记（图片+视频上传）
app.post('/api/diaries/upload', diaryUpload.fields([
  { name: 'images', maxCount: 9 },
  { name: 'video', maxCount: 1 }
]), (req, res) => {
  const { title, content, user_id, destination } = req.body;
  const { binary, tree } = compress(content); // 压缩 content
  const files = req.files;

  if (!title || !content || !user_id) {
    return res.status(400).send("缺少必要字段");
  }

  let imagePaths = [];
  if (files && files.images) {
    imagePaths = files.images.map(file => `/uploads/diaries/${file.filename}`);
  }

  let videoPath = null;
  if (files && files.video && files.video.length > 0) {
    videoPath = `/uploads/diaries/${files.video[0].filename}`;
  }

  db.query(
    'INSERT INTO diaries (user_id, title, content, huffman_tree, images, video_url, destination, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
[user_id, title, binary, tree, JSON.stringify(imagePaths), videoPath, destination],

    (err) => {
      if (err) {
        console.error('发布失败:', err);
        return res.status(500).send("发布失败");
      }

      // ✅ 重新加载并构建索引
      db.query('SELECT * FROM diaries', (err, results) => {
        if (!err) {
          buildCustomIndexes(results);
          console.log('✅ 发布后索引重构成功');
        } else {
          console.error('❌ 发布后重构索引失败:', err);
        }
      });

      res.send("发布成功");
    }
  );
});

// 增加浏览量
app.post('/api/diary/heat', (req, res) => {
  const { diary_id } = req.body;
  db.query('UPDATE diaries SET heat = heat + 1 WHERE id = ?', [diary_id], (err) => {
    if (err) return res.status(500).send("增加浏览量失败");

    // ✅ 热度更新后立即重建索引
    db.query('SELECT * FROM diaries', (err2, results) => {
      if (!err2) buildCustomIndexes(results);
    });

    res.send("浏览量增加成功");
  });
});


// 用户评分
app.post('/api/diary/ratings', (req, res) => {
  const { diary_id, user_id, rating } = req.body;
  db.query(
    'INSERT INTO diary_ratings (diary_id, user_id, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating = ?',
    [diary_id, user_id, rating, rating],
    (err, result) => {
      if (err) return res.status(500).send("评分失败");

      db.query(
        'UPDATE diaries SET rating = (SELECT AVG(rating) FROM diary_ratings WHERE diary_id = ?) WHERE id = ?',
        [diary_id, diary_id],
        (err2) => {
          if (err2) return res.status(500).send("更新评分失败");

          // ✅ 新增：评分更新成功后，重建索引
          db.query('SELECT * FROM diaries', (err3, results) => {
            if (!err3) {
              buildCustomIndexes(results);
              console.log('✅ 评分后重建索引完成');
            } else {
              console.error('❌ 评分后重建索引失败:', err3);
            }
          });

          res.send({ message: result.affectedRows > 1 ? "评分已更新" : "评分已提交" });
        }
      );
    }
  );
});


// 查询单个用户评分
app.get('/api/diary/ratings/:diary_id/:user_id', (req, res) => {
  const { diary_id, user_id } = req.params;
  db.query(
    'SELECT rating FROM diary_ratings WHERE diary_id = ? AND user_id = ?',
    [diary_id, user_id],
    (err, results) => {
      if (err) return res.status(500).send("查询评分失败");
      if (results.length === 0) return res.status(404).send("用户尚未评分该日记");
      res.json({ myRating: results[0].rating });
    }
  );
});

// 上传用户头像
app.post('/api/user/upload-avatar', avatarUpload.single('avatar'), (req, res) => {
  const { user_id } = req.body;
  if (!req.file) return res.status(400).send("没有上传文件");

  const avatarPath = `/uploads/avatars/${req.file.filename}`;
  db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, user_id], (err) => {
    if (err) return res.status(500).send('头像保存失败');
    res.json({ avatarUrl: avatarPath });
  });
});

// 查询用户头像
app.get('/api/user/avatar/:user_id', (req, res) => {
  const { user_id } = req.params;
  db.query('SELECT avatar FROM users WHERE id = ?', [user_id], (err, results) => {
    if (err) return res.status(500).send('查询头像失败');
    if (results.length > 0 && results[0].avatar) {
      res.json({ avatar: results[0].avatar });
    } else {
      res.json({ avatar: null });
    }
  });
});
// 精确查询接口
app.get('/api/diaries/hash-search', (req, res) => {
  const { keyword, sortOption } = req.query;
  if (!keyword) return res.status(400).send('缺少关键词');

  const matchedDiaries = titleHashTable[keyword] || [];

  const sorted = [...matchedDiaries];
  if (sortOption === 'heat') {
    sorted.sort((a, b) => b.heat - a.heat);
  } else if (sortOption === 'rating') {
    sorted.sort((a, b) => b.rating - a.rating);
  } else {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  res.json(sorted);
});

// 倒排索引接口
app.get('/api/diaries/inverted-search', (req, res) => {
  const { keyword, sortOption } = req.query;
  if (!keyword) return res.status(400).send('缺少关键词');

  const cleaned = keyword.replace(/\s+/g, '');
  const grams = cleaned.length >= 2 ? getNGrams(cleaned, 2) : [cleaned]; // 👈 核心修复

  const scoreMap = new Map(); // key: diary_id, value: 匹配得分

  for (const gram of grams) {
    const ids = invertedIndex[gram];
    if (!ids) continue;

    for (const id of ids) {
      scoreMap.set(id, (scoreMap.get(id) || 0) + 1);
    }
  }

  let results = diaryList
    .filter(d => scoreMap.has(d.id))
    .map(d => ({ ...d, score: scoreMap.get(d.id) }));

  // 排序
  if (sortOption === 'heat') {
    results.sort((a, b) => b.heat - a.heat);
  } else if (sortOption === 'rating') {
    results.sort((a, b) => b.rating - a.rating);
  } else if (sortOption === 'score') {
    results.sort((a, b) => b.score - a.score);
  } else {
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  res.json(results);
});





/* 评论接口 */
app.post('/api/diary/comments', (req, res) => {
  const { diary_id, user_id, comment } = req.body;
  if (!diary_id || !user_id || !comment) {
    return res.status(400).send('缺少必要字段');
  }
  db.query(
    'INSERT INTO diary_comments (diary_id, user_id, comment, created_at) VALUES (?, ?, ?, NOW())',
    [diary_id, user_id, comment],
    (err) => {
      if (err) {
        console.error('评论失败:', err);
        return res.status(500).send('服务器错误');
      }
      res.send('评论成功');
    }
  );
});
// 获取某篇日记的所有评论（带用户名和头像）
app.get('/api/diary/comments/:diary_id', (req, res) => {
  const { diary_id } = req.params;
  
  const sql = `
    SELECT diary_comments.comment, diary_comments.created_at, users.username, users.avatar 
    FROM diary_comments 
    JOIN users ON diary_comments.user_id = users.id 
    WHERE diary_comments.diary_id = ? 
    ORDER BY diary_comments.created_at DESC

  `;

  db.query(sql, [diary_id], (err, results) => {
    if (err) {
      console.error('获取评论失败:', err);
      return res.status(500).send('获取评论失败');
    }
    res.json(results);
  });
});

/* 日记推荐算法 */
/* 相似推荐算法：根据标题+内容的相似度推荐 */
app.get('/api/diaries/recommend', (req, res) => {
  const { diary_id } = req.query;

  if (!diary_id) return res.status(400).send('缺少diary_id');

  db.query(`
    SELECT diaries.*, users.username AS publisher_name,
      (SELECT COUNT(*) FROM diary_comments WHERE diary_comments.diary_id = diaries.id) AS comment_count
    FROM diaries
    JOIN users ON diaries.user_id = users.id
  `, (err, results) => {
    if (err) {
      console.error('获取日记列表失败:', err);
      return res.status(500).send('服务器内部错误');
    }

    // ✅ 解压所有内容
    const decoded = decodeDiaries(results);

    // 找当前日记
    const currentDiary = decoded.find(d => d.id == diary_id);
    if (!currentDiary) return res.status(404).send('日记不存在');

    const currentText = (currentDiary.title + ' ' + currentDiary.content).replace(/[^\w\s]/gi, '').toLowerCase();

    const similarities = decoded
      .filter(d => d.id != diary_id)
      .map(diary => {
        const text = (diary.title + ' ' + diary.content).replace(/[^\w\s]/gi, '').toLowerCase();
        const sim = computeCosineSimilarity(currentText, text);
        return { ...diary, similarity: sim };
      });

    similarities.sort((a, b) => b.similarity - a.similarity);
    const top10 = similarities.slice(0, 10);

    res.json(top10); // ✅ 不再重复解压
  });
});


// 简单分词+向量化+余弦相似度函数
function computeCosineSimilarity(text1, text2) {
  const words1 = text1.split(/\s+/);
  const words2 = text2.split(/\s+/);

  const wordSet = new Set([...words1, ...words2]);
  const wordMap = Array.from(wordSet).reduce((map, word) => {
    map[word] = { v1: 0, v2: 0 };
    return map;
  }, {});

  words1.forEach(word => {
    if (wordMap[word]) wordMap[word].v1 += 1;
  });
  words2.forEach(word => {
    if (wordMap[word]) wordMap[word].v2 += 1;
  });

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const word in wordMap) {
    const { v1, v2 } = wordMap[word];
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}


/* 日记推荐算法结束*/


// ✅ 在你的 backend 中添加 Vlog 视频生成接口

const vlogUploadPath = path.join(__dirname, 'uploads', 'vlogs');
if (!fs.existsSync(vlogUploadPath)) fs.mkdirSync(vlogUploadPath, { recursive: true });

const vlogStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, vlogUploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const vlogUpload = multer({ storage: vlogStorage });

app.post('/api/gen-vlog', vlogUpload.array('images', 9), (req, res) => {
  const text = req.body.description;
  const imagePaths = req.files.map(file => path.join(__dirname, 'uploads', 'vlogs', file.filename));
  const outputPath = path.join(__dirname, 'uploads', 'vlogs', `${Date.now()}_vlog.mp4`);

  const args = [
  'generate_vlog_v2.py',  // ✅ 改为你真正用的文件名
  '--text', text,
  '--images', ...imagePaths,
  '--output', outputPath
];


  const python = require('child_process').spawn(
  'C:/Users/wang/AppData/Local/Programs/Python/Python310/python.exe',
  args
);


  python.stderr.on('data', (data) => console.error(`stderr: ${data}`));

  python.on('close', (code) => {
    if (code === 0) {
      res.sendFile(outputPath, {
  headers: {
    'Content-Type': 'video/mp4',
    'Content-Disposition': 'inline; filename="vlog.mp4"',
  }
});

    } else {
      res.status(500).send('生成失败');
    }
  });
});

//日记删除接口
app.delete('/api/diary/:id', (req, res) => {
  const { id } = req.params;

  // 先删评论
  db.query('DELETE FROM diary_comments WHERE diary_id = ?', [id], (err) => {
    if (err) {
      console.error('删除评论失败:', err);
      return res.status(500).json({ message: '删除评论失败' });
    }

    // 再删评分
    db.query('DELETE FROM diary_ratings WHERE diary_id = ?', [id], (err) => {
      if (err) {
        console.error('删除评分失败:', err);
        return res.status(500).json({ message: '删除评分失败' });
      }

      // 最后删日记
      db.query('DELETE FROM diaries WHERE id = ?', [id], (err, result) => {
        if (err) {
          console.error('删除日记失败:', err);
          return res.status(500).json({ message: '删除日记失败' });
        }

        if (result.affectedRows > 0) {
          // ✅ 同步删除内存索引
          const deletedDiary = diaryList.find(d => d.id == id);

          if (deletedDiary) {
            // 从哈希表中删除
            delete titleHashTable[deletedDiary.title];

            // 从倒排索引中删除
            const text = `${deletedDiary.title} ${deletedDiary.content}`.toLowerCase();
            const words = text.split(/\W+/);
            for (const word of words) {
              if (invertedIndex[word]) {
                invertedIndex[word].delete(deletedDiary.id);
                if (invertedIndex[word].size === 0) {
                  delete invertedIndex[word];
                }
              }
            }

            // 从 diaryList 中删除
            diaryList = diaryList.filter(d => d.id != id);
          }

          return res.status(200).json({ message: '删除成功' });
        } else {
          return res.status(404).json({ message: '日记不存在' });
        }
      });
    });
  });
});



/*排序接口*/
app.get('/api/diaries/sorted', (req, res) => {
  const { sort } = req.query; // 支持值：heat、rating、hybrid

  db.query(`
    SELECT diaries.*, users.username AS publisher_name
    FROM diaries
    JOIN users ON diaries.user_id = users.id
  `, (err, results) => {
    if (err) return res.status(500).send('获取失败');

    let sorted = [...results]; // 拷贝数据

    // 快速排序函数（按指定字段降序）
    function quickSort(arr, key) {
      if (arr.length <= 1) return arr;
      const pivot = arr[0];
      const left = [], right = [];

      for (let i = 1; i < arr.length; i++) {
        const current = arr[i][key] || 0;
        const pivotVal = pivot[key] || 0;
        if (current >= pivotVal) {
          left.push(arr[i]);
        } else {
          right.push(arr[i]);
        }
      }

      const leftSorted = quickSort(left, key);
      const rightSorted = quickSort(right, key);

      const result = [];
      for (let i = 0; i < leftSorted.length; i++) result.push(leftSorted[i]);
      result.push(pivot);
      for (let i = 0; i < rightSorted.length; i++) result.push(rightSorted[i]);
      return result;
    }

    // 快速排序综合评分热度
    function quickSortByScore(arr) {
      if (arr.length <= 1) return arr;
      const pivot = arr[0];
      const left = [], right = [];

      for (let i = 1; i < arr.length; i++) {
        const a = arr[i].totalScore || 0;
        const b = pivot.totalScore || 0;
        if (a >= b) {
          left.push(arr[i]);
        } else {
          right.push(arr[i]);
        }
      }

      const leftSorted = quickSortByScore(left);
      const rightSorted = quickSortByScore(right);

      const result = [];
      for (let i = 0; i < leftSorted.length; i++) result.push(leftSorted[i]);
      result.push(pivot);
      for (let i = 0; i < rightSorted.length; i++) result.push(rightSorted[i]);
      return result;
    }

    // 按排序类型处理
    if (sort === 'heat') {
      sorted = quickSort(sorted, 'heat');
    } else if (sort === 'rating') {
      sorted = quickSort(sorted, 'rating');
    } else if (sort === 'hybrid') {
      // 加权综合分 = 评分 × 20 + 热度 × 0.1 + 时间得分
      sorted = sorted.map(diary => {
        const ratingScore = (diary.rating || 0) * 20;
        const heatScore = (diary.heat || 0) * 0.1;
        const timeScore = new Date(diary.created_at).getTime() / 1e10;
        return {
          ...diary,
          totalScore: ratingScore + heatScore + timeScore
        };
      });
      sorted = quickSortByScore(sorted);
    }

    res.json(decodeDiaries(sorted));
  });
});

/* 模糊匹配目的地 */
app.get('/api/diaries/search-by-destination', (req, res) => {
  const { keyword, sortOption } = req.query;
  if (!keyword) return res.status(400).send("缺少关键词");

  const allDestinations = [...new Set(diaryList.map(d => d.destination).filter(Boolean))];

  const matchedDestinations = allDestinations
    .map(dest => ({ name: dest, score: fuzzyScore(keyword, dest) }))
    .filter(item => item.score >= 50) // ✅ 添加这行，过滤不相关匹配
    .sort((a, b) => b.score - a.score)
    .map(item => item.name); // 只保留目的地名

  const matchedDiaries = diaryList.filter(d => matchedDestinations.includes(d.destination));

  // 排序
  if (sortOption === 'heat') {
    matchedDiaries.sort((a, b) => b.heat - a.heat);
  } else if (sortOption === 'rating') {
    matchedDiaries.sort((a, b) => b.rating - a.rating);
  } else {
    matchedDiaries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  res.json(matchedDiaries);
});

/* 文生图 */
const { execFileSync } = require('child_process');  // ✅ 引入模块

app.post('/api/gen-image', async (req, res) => {
  const { prompt } = req.body;

  let translatedPrompt = prompt; // 默认用原始中文

  // ✅ 第一步：调用 Python 脚本翻译为英文
  try {
    translatedPrompt = execFileSync(
      'python',
      [path.join(__dirname, 'translate_zh_to_en.py'), prompt],
      { encoding: 'utf-8' }
    ).trim();
    console.log('✅ 翻译后英文:', translatedPrompt);
  } catch (e) {
    console.error('❌ 翻译失败，使用原始中文 prompt:', e);
  }

  // ✅ 第二步：拼接 lora 标签和提示词
  const promptWithLora = `<lora:cozy animation scenes_20230824111332-000018:1>, ${translatedPrompt}, masterpiece, best quality`;

  // ✅ 第三步：调用 SD WebUI 接口生成图片
  try {
    const response = await axios.post('http://127.0.0.1:7860/sdapi/v1/txt2img', {
  prompt: promptWithLora,
  negative_prompt: 'monochrome,blurry,low quality,bad anatomy,lowres,bad proportions,out of focus,worstquality,watermark,',
  width: 512,
  height: 512,
  steps: 20,
  cfg_scale: 7,
  sampler_index: 'DPM++ 2M',
  override_settings: {
    sd_model_checkpoint: 'starlake-4.0.safetensors'
  },
  enable_hr: true,
  denoising_strength: 0.5,
  hr_scale: 2,
  hr_upscaler: "Latent",
  hr_second_pass_steps: 20
});


    const base64 = response.data.images[0];
    const buffer = Buffer.from(base64, 'base64');
    const filename = `gen_${Date.now()}.png`;
    const filePath = path.join(__dirname, 'uploads', 'generated', filename);
    fs.writeFileSync(filePath, buffer);

    res.json({ image_url: `/uploads/generated/${filename}` });

  } catch (err) {
    console.error('❌ 生成失败:', err.response?.data || err);
    res.status(500).send('图片生成失败');
  }
});


// ✅ 图生图
const upload = multer({ dest: 'uploads/' }); // 上传图片保存目录
app.post('/api/img2img', upload.single('image'), async (req, res) => {
  const { description } = req.body;
  const imagePath = req.file.path;

  let translatedPrompt = description;

  // ✅ 翻译中文描述为英文
  try {
    translatedPrompt = execFileSync(
      'python',
      [path.join(__dirname, 'translate_zh_to_en.py'), description],
      { encoding: 'utf-8' }
    ).trim();
    console.log('✅ 翻译后英文:', translatedPrompt);
  } catch (err) {
    console.error('❌ 翻译失败，使用原文:', err);
  }

  // ✅ 拼接提示词
  const prompt = `<lora:cozy animation scenes_20230824111332-000018:1>, ${translatedPrompt}, masterpiece, best quality`;

  // ✅ 读取上传图片为 base64
  const initImage = fs.readFileSync(imagePath, { encoding: 'base64' });

  try {
    const response = await axios.post('http://127.0.0.1:7860/sdapi/v1/img2img', {
      init_images: [initImage],
      prompt,
      negative_prompt: 'monochrome,blurry,low quality,bad anatomy,lowres,bad proportions,out of focus,worstquality,watermark,',
      steps: 20,
      cfg_scale: 7,
      denoising_strength: 0.5,
      sampler_index: 'DPM++ 2M',
      override_settings: {
        sd_model_checkpoint: 'starlake-4.0.safetensors'
      }
    });

    const base64 = response.data.images[0];
    const buffer = Buffer.from(base64, 'base64');
    const filename = `img2img_${Date.now()}.png`;
    const filePath = path.join(__dirname, 'uploads', 'generated', filename);
    fs.writeFileSync(filePath, buffer);

    res.json({ image_url: `/uploads/generated/${filename}` });
  } catch (err) {
    console.error('❌ 图生图失败:', err.response?.data || err);
    res.status(500).send('图生图失败');
  } finally {
    fs.unlinkSync(imagePath); // 删除临时上传图
  }
});

//cyj
// TopK算法实现
function getTopKByField(arr, field, k) {
  if (arr.length <= k) {
    return [...arr].sort((a, b) => b[field] - a[field]);
  }

  const heap = [];

  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];

    if (heap.length < k) {
      heap.push(current);
      heapifyUp(heap, heap.length - 1, field);
    } else if (current[field] > heap[0][field]) {
      heap[0] = current;
      heapifyDown(heap, 0, field);
    }
  }

  return heap.sort((a, b) => b[field] - a[field]);
}

function heapifyUp(heap, index, field) {
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);

    if (heap[parentIndex][field] <= heap[index][field]) {
      break;
    }

    [heap[parentIndex], heap[index]] = [heap[index], heap[parentIndex]];
    index = parentIndex;
  }
}

function heapifyDown(heap, index, field) {
  const length = heap.length;

  while (true) {
    const leftChildIndex = 2 * index + 1;
    const rightChildIndex = 2 * index + 2;
    let smallestIndex = index;

    if (leftChildIndex < length && heap[leftChildIndex][field] < heap[smallestIndex][field]) {
      smallestIndex = leftChildIndex;
    }

    if (rightChildIndex < length && heap[rightChildIndex][field] < heap[smallestIndex][field]) {
      smallestIndex = rightChildIndex;
    }

    if (smallestIndex === index) {
      break;
    }

    [heap[index], heap[smallestIndex]] = [heap[smallestIndex], heap[index]];
    index = smallestIndex;
  }
}

// 处理推荐数据请求
app.get('/api/recommendations', (req, res) => {
  const query = req.query.query || '';
  const filter = req.query.filter || 'hotness';
  const category = req.query.category || '';
  const isInitial = req.query.isInitial === 'true';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = 15;
  const offset = (page - 1) * itemsPerPage;

  console.log('接收到请求，参数:', {
    query, filter, category, isInitial, page, itemsPerPage
  });

  // 初始化 SQL 查询语句
  let sql = "SELECT osm_id, code, fclass, name, popularity, views, rating, rating_count, image_data, comment FROM geo_features WHERE TRIM(name) != ''";

  // 添加分类筛选条件
  if (category) {
    sql += ` AND fclass = '${category}'`;
  }

  db.query(sql, (err, allResults) => {
    if (err) {
      console.error('数据库查询失败: ', err);
      res.status(500).json({
        message: '数据库查询失败',
        results: [],
        total: 0
      });
      return;
    }

    console.log('查询到全部结果数量:', allResults.length);

    let results = allResults;
    // 处理搜索查询
    if (query) {
      results = results.map(item => {
        const nameDistance = calculateLevenshtein(query.toLowerCase(), item.name.toLowerCase());
        const fclassDistance = calculateLevenshtein(query.toLowerCase(), item.fclass.toLowerCase());

        const nameScore = Math.max(0, 100 - nameDistance);
        const fclassScore = Math.max(0, 100 - fclassDistance);

        const totalScore = nameScore * 0.6 + fclassScore * 0.4;

        return {
          ...item,
          score: totalScore,
        };
      });
    }

    let topResults;
    let total = results.length;

    if (isInitial) {
      // 初始加载时使用TopK算法
      console.log('初始加载，使用TopK算法获取前', itemsPerPage, '条数据');
      if (filter === 'hotness') {
        topResults = getTopKByField(results, 'popularity', itemsPerPage);
      } else if (filter === 'rating') {
        topResults = getTopKByField(results, 'rating', itemsPerPage);
      } else if (query) {
        topResults = getTopKByField(results, 'score', itemsPerPage);
      } else {
        topResults = results.slice(0, itemsPerPage);
      }
      console.log('TopK结果数量:', topResults.length);
    } else {
      // 非初始加载时排序和分页
      console.log('非初始加载，使用排序和分页，页码:', page);
      if (filter === 'hotness') {
        results.sort((a, b) => b.popularity - a.popularity);
      } else if (filter === 'rating') {
        results.sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.rating_count - a.rating_count;
        });
      } else if (query) {
        results.sort((a, b) => b.score - a.score);
      }

      topResults = results.slice(offset, offset + itemsPerPage);
      console.log('分页结果数量:', topResults.length);
    }

    // 转换BLOB为Base64
    const processedResults = topResults.map(item => ({
      ...item,
      cover: item.image_data
        ? `data:image/jpeg;base64,${item.image_data.toString('base64')}`
        : null,
      description: item.comment || '暂无简介'
    }));
    console.log('返回格式:', typeof processedResults, '数据长度:', processedResults.length);
    res.json({
      results: processedResults,
      total: total
    });
  });
});

app.get('/api/recom1', (req, res) => {
  const query = req.query.query || '';
  const filter = req.query.filter || 'hotness';
  const category = req.query.category || '';

  let sql = "SELECT osm_id, code, fclass, name, popularity, views, rating, rating_count, image_data, comment FROM geo_features WHERE TRIM(name) != ''";
  const params = [];

  if (category) {
    sql += ' AND fclass = ?';
    params.push(category);
  }

  if (filter === 'hotness') {
    sql += ' ORDER BY popularity DESC';
  } else if (filter === 'rating') {
    sql += ' ORDER BY rating DESC';
  }

  sql += ' LIMIT 2000';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('数据库查询失败: ', err);
      return res.status(500).json({ message: '数据库查询失败' });
    }

    if (query) {
      results = results.map(item => {
        const nameDistance = calculateLevenshtein(query.toLowerCase(), item.name.toLowerCase());
        const fclassDistance = calculateLevenshtein(query.toLowerCase(), item.fclass.toLowerCase());

        // 仅允许最多1个字符差异
        const nameScore = nameDistance <= 1 ? (100 - nameDistance) : 0;
        const fclassScore = fclassDistance <= 1 ? (100 - fclassDistance) : 0;

        const totalScore = nameScore * 0.6 + fclassScore * 0.4;

        return {
          ...item,
          nameDistance,
          fclassDistance,
          score: totalScore,
        };
      });

      // 过滤不符合条件的记录（至少有一个距离在允许范围内）
      results = results.filter(item => item.nameDistance <= 1 || item.fclassDistance <= 1);

      // 按综合评分排序
      results.sort((a, b) => b.score - a.score);
    }

    const processedResults = results.map(item => ({
      ...item,
      cover: item.image_data
        ? `data:image/jpeg;base64,${item.image_data.toString('base64')}`
        : null
    }));

    res.json(processedResults);
  });
});

app.get('/api/recom', (req, res) => {
  const query = req.query.query || '';
  const filter = req.query.filter || 'hotness';
  const category = req.query.category || '';

  let sql = "SELECT osm_id, code, fclass, name, popularity, views, rating, rating_count, image_data, comment FROM geo_features WHERE TRIM(name) != ''";
  const params = [];

  // 增加模糊匹配条件
  if (query) {
    sql += ' AND (name LIKE ? OR fclass LIKE ?)';
    const searchQuery = `%${query}%`;
    params.push(searchQuery, searchQuery);  // 使用 LIKE 进行模糊匹配
  }

  if (category) {
    sql += ' AND fclass = ?';
    params.push(category);
  }

  // 根据过滤条件排序
  if (filter === 'hotness') {
    sql += ' ORDER BY popularity DESC';
  } else if (filter === 'rating') {
    sql += ' ORDER BY rating DESC';
  }

  sql += ' LIMIT 2000';

  // 执行查询
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('数据库查询失败: ', err);
      return res.status(500).json({ message: '数据库查询失败' });
    }

    const processedResults = results.map(item => ({
      ...item,
      cover: item.image_data
        ? `data:image/jpeg;base64,${item.image_data.toString('base64')}`
        : null
    }));

    res.json(processedResults);
  });
});


// 优化后的编辑距离算法
function calculateLevenshtein(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  // 快速判断长度差异
  const lengthDiff = Math.abs(len1 - len2);
  if (lengthDiff > 3) return Infinity; // 差异超过1个字符直接返回极大值

  // 初始化二维矩阵
  const matrix = Array.from({ length: len1 + 1 }, (_, i) => [i]);
  matrix[0] = Array.from({ length: len2 + 1 }, (_, j) => j);

  // 仅需计算到最小满足条件的距离
  let minDistance = Infinity;
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );

      // 提前终止：当距离已经超过1且后续无法更小时
      if (matrix[i][j] > 1 && Math.abs(i - j) >= 1) {
        return matrix[i][j];
      }
    }
  }

  return matrix[len1][len2];
}


app.post('/api/increase-view/:osm_id', async (req, res) => {
  const { osm_id } = req.params;

  try {
    // 使用原子操作更新访问量
    const updateQuery = `
      UPDATE geo_features 
      SET views = views + 1 
      WHERE osm_id = ?
    `;

    // 执行更新
    db.query(updateQuery, [osm_id], (error, results) => {
      if (error) {
        console.error('更新访问量失败:', error);
        return res.status(500).json({ error: '数据库操作失败' });
      }

      // 检查是否成功更新
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: '未找到对应地点' });
      }

      // 获取更新后的访问量和评分
      const selectQuery = `
        SELECT views, rating 
        FROM geo_features 
        WHERE osm_id = ?
      `;

      db.query(selectQuery, [osm_id], (selectError, selectResults) => {
        if (selectError) {
          console.error('获取访问量失败:', selectError);
          return res.status(500).json({ error: '获取数据失败' });
        }

        const { views, rating } = selectResults[0];

        // 更新后的 views 是更新后最新的
        const newPopularity = (Math.log(views) + 1) * (rating + 1) + 1;

        // 更新热度
        const updatePopularityQuery = `
          UPDATE geo_features
          SET popularity = ?
          WHERE osm_id = ?
        `;
        db.query(updatePopularityQuery, [newPopularity, osm_id], (popularityError) => {
          if (popularityError) {
            console.error('更新热度失败:', popularityError);
            return res.status(500).json({ error: '更新热度失败' });
          }

          res.json({
            success: true,
            newViews: views, // 更新后访问量
            newPopularity
          });
        });
      });
    });
  } catch (err) {
    console.error('服务器错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});





app.post('/api/rate/:osm_id', async (req, res) => {
  const osmId = parseInt(req.params.osm_id);
  const score = req.body.score;

  // 参数验证
  if (isNaN(osmId)) {
    return res.status(400).json({ error: '无效的OSM ID' });
  }

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: '评分必须是1-5之间的整数' });
  }

  try {
    // 执行原子更新
    const result = await db.execute(
      `UPDATE geo_features 
       SET 
         total_score = total_score + ?,
         rating_count = rating_count + 1,
         rating = IF(rating_count + 1 > 0, (total_score + ?) / (rating_count + 1), ?)
       WHERE osm_id = ?`,
      [score, score, score, osmId]
    );

    // 获取新的评分和访问量
    const selectQuery = `
      SELECT views, rating, rating_count
      FROM geo_features
      WHERE osm_id = ?
    `;
    db.query(selectQuery, [osmId], (selectError, selectResults) => {
      if (selectError) {
        console.error('获取评分失败:', selectError);
        return res.status(500).json({ error: '获取数据失败' });
      }

      const { views, rating, rating_count } = selectResults[0];
      const newPopularity = (Math.log(views + 1) + 1) * (rating + 1);

      // 更新热度
      const updatePopularityQuery = `
        UPDATE geo_features
        SET popularity = ?
        WHERE osm_id = ?
      `;
      db.query(updatePopularityQuery, [newPopularity, osmId], (popularityError) => {
        if (popularityError) {
          console.error('更新热度失败:', popularityError);
          return res.status(500).json({ error: '更新热度失败' });
        }

        res.json({
          success: true,
          newRating: rating,  // 返回新的评分
          newRatingCount: rating_count,  // 返回新的评分人数
          newPopularity  // 返回新的热度
        });
      });
    });

  } catch (error) {
    console.error('数据库操作失败:', error);
    res.status(500).json({
      error: '服务器错误',
      details: error.message
    });
  }
});

// 启动服务器
app.listen(port, ip, () => {
  console.log(`🚀 后端服务已启动: http://10.29.22.120:${port}`);
  console.log('✅ 当前server.js已经是4.5版本含了 /api/diaries/upload 等接口！');
});
