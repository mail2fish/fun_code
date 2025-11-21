import { Excalidraw, MainMenu, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { HOST_URL } from "~/config";
import { fetchWithAuth } from "~/utils/api";

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';
type ExcalidrawLangCode = 'en' | 'zh-CN' | 'zh-TW';

const IconSave = () => (
  <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
);
const IconBack = () => (
  <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
);

export default function ExcalidrawScratchFlowchartPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [langCode, setLangCode] = useState<ExcalidrawLangCode>('zh-CN');
  const [boardTitle, setBoardTitle] = useState<string>('');

  const menuLabels = useMemo(() => {
    switch (langCode) {
      case 'en':
        return { backLabel: 'Back', saveLabel: 'Save' };
      case 'zh-TW':
        return { backLabel: '返回', saveLabel: '保存' };
      default:
        return { backLabel: '返回', saveLabel: '保存' };
    }
  }, [langCode]);

  const mapBrowserLanguageToExcalidraw = useCallback((lang: string | null | undefined): ExcalidrawLangCode => {
    const lower = (lang || '').toLowerCase();
    if (lower.startsWith('zh')) {
      if (lower.includes('hans') || lower === 'zh' || lower.startsWith('zh-cn') || lower.startsWith('zh-sg')) return 'zh-CN';
      if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-mo') || lower.includes('hant')) return 'zh-TW';
      return 'zh-CN';
    }
    return 'en';
  }, []);

  useEffect(() => {
    const fromStorage = localStorage.getItem('excalidraw.lang');
    let nextLang: ExcalidrawLangCode;
    if (fromStorage) {
      nextLang = mapBrowserLanguageToExcalidraw(fromStorage);
    } else if (navigator.languages && navigator.languages.length > 0) {
      nextLang = mapBrowserLanguageToExcalidraw(navigator.languages[0]);
    } else {
      nextLang = mapBrowserLanguageToExcalidraw(navigator.language);
    }
    setLangCode(nextLang);
  }, [mapBrowserLanguageToExcalidraw]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [navigate]);

  const createBoard = useCallback(async (elements: any[], appState: AppState, files: BinaryFiles, title?: string) => {
    try {
      setSaveStatus('saving');
      const boardData = {
        name: title || boardTitle || `流程图 ${new Date().toLocaleString()}`,
        file_content: {
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements,
          appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize, theme: appState.theme },
          files,
        },
      };
      const response = await fetchWithAuth(`${HOST_URL}/api/excalidraw/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boardData),
      });
      if (!response.ok) throw new Error('创建失败');
      const result = await response.json();
      const newBoardId = result.data.id;
      navigate(`/www/excalidraw/open/${newBoardId}`, { replace: true });
      setSaveStatus('saved');
      if (excalidrawAPI) excalidrawAPI.setToast({ message: "流程图已创建", duration: 2000, closable: true });
      return newBoardId;
    } catch (error) {
      console.error('创建画板失败:', error);
      setSaveStatus('error');
      if (excalidrawAPI) excalidrawAPI.setToast({ message: "创建失败，请重试", duration: 3000, closable: true });
      throw error;
    }
  }, [navigate, excalidrawAPI, boardTitle]);

  // 加载 Mermaid 并转换为 Excalidraw 元素
  useEffect(() => {
    if (!excalidrawAPI || !projectId) return;

    const loadMermaidAndConvert = async () => {
      try {
        setLoadStatus('loading');
        
        // 调用后端 API 获取 mermaid 字符串
        const res = await fetchWithAuth(`${HOST_URL}/api/admin/flowchart/scratch/${projectId}`);
        if (!res.ok) {
          throw new Error('获取流程图失败');
        }
        const result = await res.json();
        let mermaidString = result.data?.mermaid || result.mermaid;
        
        if (!mermaidString) {
          throw new Error('未获取到流程图数据');
        }

        // 确保 mermaid 字符串中的换行符被正确处理
        // JSON 解析后，\n 应该已经是换行符，但为了保险起见，我们确保处理字面的 \n
        if (typeof mermaidString === 'string') {
          // 如果字符串中包含字面的 \n（两个字符），替换为实际的换行符
          mermaidString = mermaidString.replace(/\\n/g, '\n');
        }

        console.log('Mermaid 字符串长度:', mermaidString.length);
        console.log('Mermaid 字符串前100个字符:', mermaidString.substring(0, 100));

        // 尝试使用 @excalidraw/mermaid-to-excalidraw 转换
        try {
          // 动态导入 mermaid-to-excalidraw 包
          let mermaidToExcalidraw;
          try {
            mermaidToExcalidraw = await import("@excalidraw/mermaid-to-excalidraw");
          } catch (importError) {
            throw new Error('无法加载 @excalidraw/mermaid-to-excalidraw 包，请先安装: npm install @excalidraw/mermaid-to-excalidraw');
          }
          
          // 检查导出的函数
          const parseMermaidToExcalidraw = mermaidToExcalidraw.parseMermaidToExcalidraw;
          
          if (!parseMermaidToExcalidraw || typeof parseMermaidToExcalidraw !== 'function') {
            throw new Error('parseMermaidToExcalidraw 函数未找到，请检查包版本');
          }
          
          console.log('开始解析 Mermaid...');
          
          // 解析 Mermaid 为 Excalidraw 元素
          // 配置选项：fontSize 应该在 themeVariables 中
          const parseResult = await parseMermaidToExcalidraw(mermaidString, {
            themeVariables: {
              fontSize: '20px',
            },
          });

          console.log('解析结果:', parseResult);
          
          // parseResult 应该包含 elements (ExcalidrawElementSkeleton[]) 和 files
          const elementsSkeleton = parseResult.elements;
          const files = parseResult.files || {};
          
          if (!elementsSkeleton) {
            throw new Error('解析结果中没有找到 elements');
          }

          // 验证元素数组
          if (!Array.isArray(elementsSkeleton)) {
            throw new Error('解析结果不是有效的元素数组');
          }

          if (elementsSkeleton.length === 0) {
            throw new Error('未生成任何元素');
          }

          console.log('Skeleton 元素数量:', elementsSkeleton.length);
          console.log('第一个 Skeleton 元素示例:', elementsSkeleton[0]);

          // 将 ExcalidrawElementSkeleton 转换为完整的 Excalidraw 元素
          const elements = convertToExcalidrawElements(elementsSkeleton, {
            regenerateIds: false,
          });

          if (!elements || elements.length === 0) {
            throw new Error('转换后没有有效元素');
          }

          console.log('转换后的元素数量:', elements.length);
          console.log('第一个元素示例:', elements[0]);

          // 更新场景
          excalidrawAPI.updateScene({ 
            elements, 
            appState: { 
              ...excalidrawAPI.getAppState(), 
              isLoading: false 
            } 
          });
          
          if (files && Object.keys(files).length > 0) {
            excalidrawAPI.addFiles(Object.values(files));
          }

          // 设置标题
          const projectNameFromApi = result.data?.project_name || result.project_name;
          const projectName = projectNameFromApi || '未命名项目';
          setBoardTitle(`流程图： ${projectName} `);
          document.title = `流程图 - ${projectName}`;

          setLoadStatus('loaded');
          excalidrawAPI.setToast({ message: "流程图已加载", duration: 2000, closable: true });
        } catch (mermaidError) {
          // 如果 mermaid-to-excalidraw 包不存在或转换失败，显示错误信息
          console.error('Mermaid 转换失败:', mermaidError);
          console.error('错误详情:', mermaidError);
          console.error('Mermaid 字符串:', mermaidString);
          
          const errorMessage = mermaidError instanceof Error 
            ? mermaidError.message 
            : String(mermaidError);
          
          excalidrawAPI.setToast({ 
            message: `Mermaid 转换失败: ${errorMessage}`, 
            duration: 5000, 
            closable: true 
          });
          setLoadStatus('error');
        }
      } catch (error) {
        console.error('加载流程图失败:', error);
        setLoadStatus('error');
        if (excalidrawAPI) {
          excalidrawAPI.setToast({ 
            message: `加载失败：${error instanceof Error ? error.message : '未知错误'}`, 
            duration: 3000, 
            closable: true 
          });
        }
      }
    };

    loadMermaidAndConvert();
  }, [excalidrawAPI, projectId]);

  const handleManualSave = useCallback(() => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();
    if (!elements || elements.length === 0) {
      if (excalidrawAPI) {
        excalidrawAPI.setToast({ message: "暂无可保存内容", duration: 2000, closable: true });
      }
      return;
    }
    createBoard([...elements], appState, files);
  }, [excalidrawAPI, createBoard]);

  const handleChange = useCallback((elements: readonly any[], appState: AppState, files: BinaryFiles) => {
    // 自动保存功能可以在这里实现
    setSaveStatus('idle');
  }, []);

  const getStatusDisplay = () => {
    if (loadStatus === 'loading') return { text: '加载中...', color: '#2196F3' };
    if (loadStatus === 'error') return { text: '加载失败', color: '#f44336' };
    switch (saveStatus) {
      case 'saving': return { text: '保存中...', color: '#FF9800' };
      case 'saved': return { text: '已保存', color: '#4CAF50' };
      case 'error': return { text: '保存失败', color: '#f44336' };
      default: return { text: '', color: 'transparent' };
    }
  };

  if (!projectId) {
    return (
      <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "#666" }}>
        错误：未找到项目ID
      </div>
    );
  }

  const statusDisplay = getStatusDisplay();

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 999, padding: '8px 12px', borderRadius: '4px', fontSize: '14px', backgroundColor: statusDisplay.color, color: statusDisplay.text ? 'white' : 'transparent' }}>
        {statusDisplay.text}
      </div>
      <div style={{ paddingLeft: '0px', height: '100%', width: '100%' }}>
        <Excalidraw excalidrawAPI={setExcalidrawAPI} onChange={handleChange} theme="light" langCode={langCode}>
          <MainMenu>
            <MainMenu.Item onSelect={handleManualSave} disabled={saveStatus === 'saving' || loadStatus === 'loading'}>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <IconSave />{menuLabels.saveLabel}
              </span>
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.Item onSelect={handleBack}>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <IconBack />{menuLabels.backLabel}
              </span>
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.Export />
          </MainMenu>
        </Excalidraw>
      </div>
    </div>
  );
}

