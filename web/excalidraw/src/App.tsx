import { Excalidraw } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import './App.css'
import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { HOST_URL } from "./config"

// 保存状态类型
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// 加载状态类型
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

function App() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  
  // 检测是否是新建模式
  const isNewBoard = location.pathname === '/excalidraw/new';
  
  // 节流保存的引用
  const saveTimeoutRef = useRef<number | null>(null);

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
      navigate(`/excalidraw/${newBoardId}`, { replace: true });

      setSaveStatus('saved');
      
      // 显示成功提示
      if (excalidrawAPI) {
        excalidrawAPI.setToast({
          message: "画板已创建",
          duration: 2000,
          closable: true
        });
      }
      
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
  }, [navigate, excalidrawAPI]);

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
  }, [excalidrawAPI]);

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

      {/* 手动保存按钮 */}
      <button
        onClick={handleManualSave}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 999,
          padding: '8px 16px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: '#007bff',
          color: 'white',
          cursor: 'pointer',
          fontSize: '14px'
        }}
        disabled={saveStatus === 'saving' || loadStatus === 'loading'}
      >
        {loadStatus === 'loading' ? '加载中...' : 
         saveStatus === 'saving' ? (isNewBoard ? '创建中...' : '保存中...') : 
         (isNewBoard ? '创建' : '保存')}
      </button>

      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        onChange={handleChange}
        // 可以添加其他props，比如主题等
        theme="light"
      />
    </div>
  );
}

export default App;
