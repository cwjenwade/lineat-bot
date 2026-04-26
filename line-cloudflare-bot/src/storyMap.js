// 唯一維護入口：所有關鍵字回應請只在這裡新增/調整。
// 節點型態：
// - text  節點：{ type: 'text', text: '...' }
// - image 節點：{ type: 'image', fileName: '...' }

export const storyMap = {
  開始: {
    type: 'text',
    text: '故事開始了！請輸入：左 或 右 來前進。'
  },
  左: {
    type: 'image',
    fileName: 'left-path.jpg'
  },
  右: {
    type: 'image',
    fileName: 'right-path.jpg'
  },
  再來一次: {
    type: 'text',
    text: '好的，我們從頭開始。請輸入：開始'
  },
  幫助: {
    type: 'text',
    text: '可用關鍵字：開始、左、右、再來一次、幫助'
  }
};

export function getStoryNodeByKeyword(rawKeyword = '') {
  const keyword = `${rawKeyword}`.trim();
  if (!keyword) return null;
  return storyMap[keyword] || null;
}
