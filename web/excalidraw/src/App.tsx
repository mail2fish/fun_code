import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawElement, AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import './App.css'
import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { HOST_URL } from "./config"

// 保存状态类型
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function App() {
  const { boardId } = useParams<{ boardId: string }>();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  
  // 节流保存的引用
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 更新现有画板
  const updateBoard = useCallback(async (boardId: string, elements: ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
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

  // 处理变化事件（含节流）
  const handleChange = useCallback((elements: ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 只在有元素且有画板ID时才保存
    if (elements.length === 0 || !boardId) {
      return;
    }

    // 设置新的节流定时器（2秒后保存）
    saveTimeoutRef.current = setTimeout(() => {
      updateBoard(boardId, elements, appState, files);
    }, 2000);
    
    // 设置保存状态为准备中
    setSaveStatus('idle');
  }, [boardId, updateBoard]);

  // 手动保存
  const handleManualSave = useCallback(() => {
    if (!excalidrawAPI || !boardId) return;
    
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();
    
    updateBoard(boardId, elements, appState, files);
  }, [excalidrawAPI, boardId, updateBoard]);

  // 获取保存状态显示文本
  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving': return '保存中...';
      case 'saved': return '已保存';
      case 'error': return '保存失败';
      default: return '';
    }
  };

  // 如果没有画板ID，显示错误信息
  if (!boardId) {
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

  return (
    <div className="excalidraw-container" style={{ height: "100vh", width: "100vw", position: "relative" }}>
      {/* 保存状态指示器 */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 999,
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '14px',
        backgroundColor: saveStatus === 'saved' ? '#4CAF50' : 
                        saveStatus === 'saving' ? '#FF9800' : 
                        saveStatus === 'error' ? '#f44336' : 'transparent',
        color: saveStatus !== 'idle' ? 'white' : 'transparent'
      }}>
        {getSaveStatusText()}
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
        disabled={saveStatus === 'saving'}
      >
        {saveStatus === 'saving' ? '保存中...' : '保存'}
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
