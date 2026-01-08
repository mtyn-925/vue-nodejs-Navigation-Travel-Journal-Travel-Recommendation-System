const express = require('express');
const router = express.Router();

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
router.get('/api/recommendations', (req, res) => {
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
        results = quickSort(results, 'popularity');
      } else if (filter === 'rating') {
        results = quickSortByRating(results);
      } else if (query) {
        results = quickSort(results, 'score');
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

// 快速排序算法
function quickSort(arr, field) {
  if (arr.length <= 1) return arr;

  const pivot = arr[0];
  const left = [];
  const right = [];

  for (let i = 1; i < arr.length; i++) {
    if (arr[i][field] > pivot[field]) {
      left.push(arr[i]);
    } else {
      right.push(arr[i]);
    }
  }

  return [...quickSort(left, field), pivot, ...quickSort(right, field)];
}

// 根据评分排序
function quickSortByRating(arr) {
  if (arr.length <= 1) return arr;

  const pivot = arr[0];
  const left = [];
  const right = [];

  for (let i = 1; i < arr.length; i++) {
    if (arr[i].rating > pivot.rating ||
      (arr[i].rating === pivot.rating && arr[i].rating_count > pivot.rating_count)) {
      left.push(arr[i]);
    } else {
      right.push(arr[i]);
    }
  }

  return [...quickSortByRating(left), pivot, ...quickSortByRating(right)];
}


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

router.post('/api/increase-view/:osm_id', async (req, res) => {
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





router.post('/api/rate/:osm_id', async (req, res) => {
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

module.exports = router;
