import { Excalidraw, exportToBlob, MainMenu } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import './App.css'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { HOST_URL } from "./config"

// 保存状态类型
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// 加载状态类型
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

// Excalidraw 语言代码（常用）
type ExcalidrawLangCode = 'en' | 'zh-CN' | 'zh-TW';

// 菜单图标（描边风格，跟默认菜单更一致）
const IconNew = () => (
  <svg
    width="1.25em"
    height="1.25em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable="false"
  >
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const IconSave = () => (
  <svg
    width="1.25em"
    height="1.25em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable="false"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);

const IconBack = () => (
  <svg
    width="1.25em"
    height="1.25em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable="false"
  >
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);



const IconRename = () => (
  <svg
    width="1.25em"
    height="1.25em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable="false"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

function App() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [langCode, setLangCode] = useState<ExcalidrawLangCode>('en');
  const [boardTitle, setBoardTitle] = useState<string>('');
  const [isRenameOpen, setIsRenameOpen] = useState<boolean>(false);
  const [renameValue, setRenameValue] = useState<string>('');
  const menuLabels = useMemo(() => {
    switch (langCode) {
      case 'en':
        return { newLabel: 'New', saveLabel: 'Save', backLabel: 'Back', renameLabel: 'Rename' };
      case 'zh-TW':
        return { newLabel: '新建', saveLabel: '保存', backLabel: '返回', renameLabel: '重命名' };
      default:
        return { newLabel: '新建', saveLabel: '保存', backLabel: '返回', renameLabel: '重命名' };
    }
  }, [langCode]);
  
  // 检测是否是新建模式
  const isNewBoard = location.pathname === '/excalidraw/new';
  
  // 节流保存的引用
  const saveTimeoutRef = useRef<number | null>(null);
  
  
  // 保存缩略图
  const saveThumbnail = useCallback(async (boardId: string) => {
    if (!excalidrawAPI) {
      console.log('excalidrawAPI 不可用，跳过缩略图保存');
      return;
    }

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      
      // 如果没有元素，跳过缩略图生成
      if (elements.length === 0) {
        console.log('没有元素，跳过缩略图生成');
        return;
      }

      // 方法1：先生成一个临时的大图，包含所有内容
      const tempBlob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          viewBackgroundColor: '#ffffff',
          exportWithDarkMode: false,
        },
        files,
        mimeType: "image/png",
        exportPadding: 50, // 添加充足的内边距
      });

      // 方法2：直接创建固定尺寸的缩略图
      const blob = tempBlob; // 暂时使用临时生成的图片
      
      console.log('缩略图生成完成，blob大小：', blob.size);

      // 创建 FormData
      const formData = new FormData();
      formData.append('thumbnail', blob, 'thumbnail.png');

      // 上传缩略图
      const response = await fetch(`${HOST_URL}/api/excalidraw/boards/${boardId}/thumbnail`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('缩略图保存失败');
      }

      console.log('缩略图保存成功');
      
    } catch (error) {
      console.error('保存缩略图失败:', error);
      // 不显示错误提示，因为缩略图保存失败不应该影响主要功能
    }
  }, [excalidrawAPI]);

  // 返回处理函数
  const handleBack = useCallback(() => {
    // 首先尝试使用浏览器历史记录返回
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // 如果没有历史记录，返回根路径
      navigate('/');
    }
  }, [navigate]);

  // 新建空白画板，并跳转到新建路由
  const handleNewBoard = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (excalidrawAPI) {
      const currentAppState = excalidrawAPI.getAppState();
      excalidrawAPI.updateScene({
        elements: [],
        appState: {
          ...currentAppState,
          openMenu: null,
          isLoading: false,
        },
      });
      excalidrawAPI.setToast({ message: menuLabels.newLabel === 'New' ? 'New canvas created' : '已新建空白画板', duration: 2000, closable: true });
    }

    setSaveStatus('idle');
    setLoadStatus('idle');
    navigate('/excalidraw/new');
  }, [excalidrawAPI, navigate, menuLabels.newLabel]);

  // 将浏览器语言映射为 Excalidraw 支持的语言
  const mapBrowserLanguageToExcalidraw = useCallback((lang: string | null | undefined): ExcalidrawLangCode => {
    const lower = (lang || '').toLowerCase();
    if (lower.startsWith('zh')) {
      // 简体优先（包含 zh, zh-cn, zh-hans 等）
      if (lower.includes('hans') || lower === 'zh' || lower.startsWith('zh-cn') || lower.startsWith('zh-sg')) {
        return 'zh-CN';
      }
      // 繁体（台湾/香港/澳门）
      if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-mo') || lower.includes('hant')) {
        return 'zh-TW';
      }
      return 'zh-CN';
    }
    return 'en';
  }, []);

  // 初始化并根据浏览器语言/URL/localStorage 自动设置语言
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get('lang');
    const fromStorage = localStorage.getItem('excalidraw.lang');

    let nextLang: ExcalidrawLangCode;
    if (fromQuery) {
      nextLang = mapBrowserLanguageToExcalidraw(fromQuery);
      localStorage.setItem('excalidraw.lang', nextLang);
    } else if (fromStorage) {
      nextLang = mapBrowserLanguageToExcalidraw(fromStorage);
    } else if (navigator.languages && navigator.languages.length > 0) {
      nextLang = mapBrowserLanguageToExcalidraw(navigator.languages[0]);
    } else {
      nextLang = mapBrowserLanguageToExcalidraw(navigator.language);
    }

    setLangCode(nextLang);
  }, [location.search, mapBrowserLanguageToExcalidraw]);

  // 监听系统语言变化，动态切换
  useEffect(() => {
    const onLanguageChange = () => {
      const next = mapBrowserLanguageToExcalidraw(navigator.language);
      setLangCode(next);
    };
    window.addEventListener('languagechange', onLanguageChange);
    return () => window.removeEventListener('languagechange', onLanguageChange);
  }, [mapBrowserLanguageToExcalidraw]);

  // 创建新画板
  const createBoard = useCallback(async (elements: any[], appState: AppState, files: BinaryFiles, title?: string) => {
    try {
      setSaveStatus('saving');
      
      const boardData = {
        name: title || boardTitle || `画板 ${new Date().toLocaleString()}`, // 使用标题或默认名称
        file_content: {
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements: elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            gridSize: appState.gridSize,
            theme: appState.theme,
          },
          files: files
        }
      };

      const response = await fetch(`${HOST_URL}/api/excalidraw/boards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(boardData)
      });

      if (!response.ok) {
        throw new Error('创建失败');
      }

      const result = await response.json();
      const newBoardId = result.data.id;

      // 替换浏览器路径
      navigate(`/excalidraw/open/${newBoardId}`, { replace: true });

      setSaveStatus('saved');
      
      // 显示成功提示
      if (excalidrawAPI) {
        excalidrawAPI.setToast({
          message: "画板已创建",
          duration: 2000,
          closable: true
        });
      }
      
      // 保存缩略图
      saveThumbnail(newBoardId.toString());
      
      return newBoardId;
      
    } catch (error) {
      console.error('创建画板失败:', error);
      setSaveStatus('error');
      
      if (excalidrawAPI) {
        excalidrawAPI.setToast({
          message: "创建失败，请重试",
          duration: 3000,
          closable: true
        });
      }
      throw error;
    }
  }, [navigate, excalidrawAPI, saveThumbnail]);

  // 更新现有画板
  const updateBoard = useCallback(async (boardId: string, elements: any[], appState: AppState, files: BinaryFiles, title?: string) => {
    try {
      setSaveStatus('saving');
      
      const boardData = {
        ...(title !== undefined && { name: title }), // 只有提供了标题才更新名称
        file_content: {
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements: elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            gridSize: appState.gridSize,
            theme: appState.theme,
          },
          files: files
        }
      };

      const response = await fetch(`${HOST_URL}/api/excalidraw/boards/${boardId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(boardData)
      });

      if (!response.ok) {
        throw new Error('更新失败');
      }

      setSaveStatus('saved');
      
      // 显示成功提示
      if (excalidrawAPI) {
        excalidrawAPI.setToast({
          message: "画板已更新",
          duration: 2000,
          closable: true
        });
      }
      
      // 保存缩略图
      saveThumbnail(boardId);
      
    } catch (error) {
      console.error('更新画板失败:', error);
      setSaveStatus('error');
      
      if (excalidrawAPI) {
        excalidrawAPI.setToast({
          message: "更新失败，请重试",
          duration: 3000,
          closable: true
        });
      }
    }
  }, [excalidrawAPI, saveThumbnail]);

  // 加载现有画板
  const loadBoard = useCallback(async (boardId: string) => {
    try {
      setLoadStatus('loading');
      
      const response = await fetch(`${HOST_URL}/api/excalidraw/boards/${boardId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('加载失败');
      }

      const result = await response.json();
      const boardData = result.data;
      
      // 设置标题
      if (boardData.name) {
        setBoardTitle(boardData.name);
        // 同步更新页面标题
        document.title = boardData.name;
      }
      
      // 解析board_json
      let sceneData;
      try {
        sceneData = JSON.parse(boardData.board_json);
      } catch (e) {
        throw new Error('画板数据格式错误');
      }

      // 使用excalidrawAPI加载场景数据
      if (excalidrawAPI && sceneData) {
        // 更新场景元素和应用状态
        excalidrawAPI.updateScene({
          elements: sceneData.elements || [],
          appState: {
            ...sceneData.appState,
            // 保持一些默认状态
            isLoading: false,
          },
        });
        
        // 如果有文件数据，单独设置文件
        if (sceneData.files) {
          excalidrawAPI.addFiles(Object.values(sceneData.files));
        }
      }

      setLoadStatus('loaded');
      
      // 显示加载成功提示
      if (excalidrawAPI) {
        excalidrawAPI.setToast({
          message: "画板已加载",
          duration: 2000,
          closable: true
        });
      }
      
    } catch (error) {
      console.error('加载画板失败:', error);
      setLoadStatus('error');
      
      if (excalidrawAPI) {
        excalidrawAPI.setToast({
          message: "加载失败，请重试",
          duration: 3000,
          closable: true
        });
      }
    }
  }, [excalidrawAPI]);

  // 处理变化事件（含节流）
  const handleChange = useCallback((elements: readonly any[], appState: AppState, files: BinaryFiles) => {
    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 只在有元素时才保存
    if (elements.length === 0) {
      return;
    }

    // 设置新的节流定时器（30秒后保存）
    saveTimeoutRef.current = setTimeout(() => {
      if (isNewBoard) {
        // 新建模式：调用创建画板API
        createBoard([...elements], appState, files);
      } else if (boardId) {
        // 更新模式：调用更新画板API
        updateBoard(boardId, [...elements], appState, files);
      }
    }, 30000);
    
    // 设置保存状态为准备中
    setSaveStatus('idle');
  }, [isNewBoard, boardId, createBoard, updateBoard]);

  // 手动保存
  const handleManualSave = useCallback(() => {
    if (!excalidrawAPI) return;
    
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();
    
    if (isNewBoard) {
      // 新建模式：调用创建画板API
      createBoard([...elements], appState, files);
    } else if (boardId) {
      // 更新模式：调用更新画板API
      updateBoard(boardId, [...elements], appState, files);
    }
  }, [excalidrawAPI, isNewBoard, boardId, createBoard, updateBoard]);



  // 在组件挂载和boardId变化时加载画板数据
  useEffect(() => {
    // 只有当excalidrawAPI可用、有boardId、不是新建模式时才加载
    if (excalidrawAPI && boardId && !isNewBoard && parseInt(boardId) > 0) {
      loadBoard(boardId);
    } else if (isNewBoard) {
      // 新建模式时清空标题并重置页面标题
      setBoardTitle('');
      document.title = '画板';
    }
  }, [excalidrawAPI, boardId, isNewBoard, loadBoard]);

  // 获取状态显示文本和颜色
  const getStatusDisplay = () => {
    // 优先显示加载状态
    if (loadStatus === 'loading') {
      return { text: '加载中...', color: '#2196F3' };
    }
    if (loadStatus === 'error') {
      return { text: '加载失败', color: '#f44336' };
    }
    
    // 然后显示保存状态
    switch (saveStatus) {
      case 'saving': return { text: '保存中...', color: '#FF9800' };
      case 'saved': return { text: '已保存', color: '#4CAF50' };
      case 'error': return { text: '保存失败', color: '#f44336' };
      default: return { text: '', color: 'transparent' };
    }
  };

  // 如果没有画板ID且不是新建模式，显示错误信息
  if (!boardId && !isNewBoard) {
    return (
      <div style={{ 
        height: "100vh", 
        width: "100vw", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        fontSize: "18px",
        color: "#666"
      }}>
        错误：未找到画板ID
      </div>
    );
  }

  const statusDisplay = getStatusDisplay();

  return (
    <div className="excalidraw-container" style={{ height: "100vh", width: "100vw", position: "relative" }}>


      {/* 状态指示器 */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 999,
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '14px',
        backgroundColor: statusDisplay.color,
        color: statusDisplay.text ? 'white' : 'transparent'
      }}>
        {statusDisplay.text}
      </div>

      {/* Excalidraw 容器，左侧留出合适空间 */}
      <div style={{ 
        paddingLeft: '0px', // 菜单现在在最左边，不需要左边距
        height: '100%', 
        width: '100%' 
      }}>
        <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        onChange={handleChange}
        theme="light"
        langCode={langCode}
      >
        <MainMenu>
          <MainMenu.Item onSelect={handleNewBoard}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <IconNew />
              {menuLabels.newLabel}
            </span>
          </MainMenu.Item>
          <MainMenu.Item onSelect={handleManualSave} disabled={saveStatus === 'saving' || loadStatus === 'loading'}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <IconSave />
              {menuLabels.saveLabel}
            </span>
          </MainMenu.Item>
          <MainMenu.Item onSelect={() => { setRenameValue(boardTitle); setIsRenameOpen(true); }}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <IconRename />
              {menuLabels.renameLabel}
            </span>
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />

          <MainMenu.Item onSelect={handleBack}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <IconBack />
              {menuLabels.backLabel}
            </span>
          </MainMenu.Item>
        </MainMenu>
        </Excalidraw>
        {isRenameOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}>
            <div style={{
              background: '#ffffff',
              width: 'min(520px, 92vw)',
              borderRadius: 8,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              padding: 20,
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                {menuLabels.renameLabel}
              </div>
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder={langCode === 'en' ? 'Enter a new title' : '请输入新标题'}
                style={{
                  width: '100%',
                  height: 40,
                  padding: '8px 12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const btn = document.getElementById('rename-confirm-btn') as HTMLButtonElement | null;
                    btn?.click();
                  }
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  onClick={() => setIsRenameOpen(false)}
                  style={{
                    height: 36,
                    padding: '6px 12px',
                    background: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {langCode === 'en' ? 'Cancel' : '取消'}
                </button>
                <button
                  id="rename-confirm-btn"
                  onClick={() => {
                    const nextTitle = renameValue.trim();
                    if (!nextTitle) { setIsRenameOpen(false); return; }
                    setBoardTitle(nextTitle);
                    document.title = nextTitle;
                    if (excalidrawAPI) {
                      const elements = excalidrawAPI.getSceneElements();
                      const appState = excalidrawAPI.getAppState();
                      const files = excalidrawAPI.getFiles();
                      if (isNewBoard) {
                        createBoard([...elements], appState, files, nextTitle);
                      } else if (boardId) {
                        updateBoard(boardId, [...elements], appState, files, nextTitle);
                      }
                    }
                    setIsRenameOpen(false);
                  }}
                  style={{
                    height: 36,
                    padding: '6px 14px',
                    background: '#111827',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {langCode === 'en' ? 'Save' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
