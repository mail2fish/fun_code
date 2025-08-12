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

function App() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [langCode, setLangCode] = useState<ExcalidrawLangCode>('en');
  const menuLabels = useMemo(() => {
    switch (langCode) {
      case 'en':
        return { newLabel: 'New', saveLabel: 'Save' };
      case 'zh-TW':
        return { newLabel: '新建', saveLabel: '保存' };
      default:
        return { newLabel: '新建', saveLabel: '保存' };
    }
  }, [langCode]);
  
  // 检测是否是新建模式
  const isNewBoard = location.pathname === '/www/excalidraw/new';
  
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
    navigate('/www/excalidraw/new');
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
  const createBoard = useCallback(async (elements: any[], appState: AppState, files: BinaryFiles) => {
    try {
      setSaveStatus('saving');
      
      const boardData = {
        name: `画板 ${new Date().toLocaleString()}`, // 默认名称
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
      navigate(`/www/excalidraw/${newBoardId}`, { replace: true });

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
  const updateBoard = useCallback(async (boardId: string, elements: any[], appState: AppState, files: BinaryFiles) => {
    try {
      setSaveStatus('saving');
      
      const boardData = {
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

      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        onChange={handleChange}
        // 可以添加其他props，比如主题等
        theme="light"
        langCode={langCode}
      >
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
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
        </MainMenu>
      </Excalidraw>
    </div>
  );
}

export default App;
