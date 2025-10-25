import { Excalidraw, exportToBlob, MainMenu } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { HOST_URL } from "~/config";

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';
type ExcalidrawLangCode = 'en' | 'zh-CN' | 'zh-TW';

const IconNew = () => (
  <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);
const IconSave = () => (
  <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
);
const IconBack = () => (
  <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
);
const IconRename = () => (
  <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);

export default function ExcalidrawEditor() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [langCode, setLangCode] = useState<ExcalidrawLangCode>('zh-CN');
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

  const isNewBoard = location.pathname === '/www/excalidraw/new';
  const saveTimeoutRef = useRef<number | null>(null);

  const saveThumbnail = useCallback(async (id: string) => {
    if (!excalidrawAPI) return;
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      if (elements.length === 0) return;
      const tempBlob = await exportToBlob({
        elements,
        appState: { ...appState, exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
        files,
        mimeType: "image/png",
        exportPadding: 50,
      });
      const formData = new FormData();
      formData.append('thumbnail', tempBlob, 'thumbnail.png');
      await fetch(`${HOST_URL}/api/excalidraw/boards/${id}/thumbnail`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: formData,
      });
    } catch {}
  }, [excalidrawAPI]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [navigate]);

  const handleNewBoard = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (excalidrawAPI) {
      const currentAppState = excalidrawAPI.getAppState();
      excalidrawAPI.updateScene({ elements: [], appState: { ...currentAppState, openMenu: null, isLoading: false } });
      excalidrawAPI.setToast({ message: menuLabels.newLabel === 'New' ? 'New canvas created' : '已新建空白画板', duration: 2000, closable: true });
    }
    setSaveStatus('idle');
    setLoadStatus('idle');
    navigate('/www/excalidraw/new');
  }, [excalidrawAPI, navigate, menuLabels.newLabel]);

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

  useEffect(() => {
    const onLanguageChange = () => {
      const next = mapBrowserLanguageToExcalidraw(navigator.language);
      setLangCode(next);
    };
    window.addEventListener('languagechange', onLanguageChange);
    return () => window.removeEventListener('languagechange', onLanguageChange);
  }, [mapBrowserLanguageToExcalidraw]);

  const createBoard = useCallback(async (elements: any[], appState: AppState, files: BinaryFiles, title?: string) => {
    try {
      setSaveStatus('saving');
      const boardData = {
        name: title || boardTitle || `画板 ${new Date().toLocaleString()}`,
        file_content: {
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements,
          appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize, theme: appState.theme },
          files,
        },
      };
      const response = await fetch(`${HOST_URL}/api/excalidraw/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(boardData),
      });
      if (!response.ok) throw new Error('创建失败');
      const result = await response.json();
      const newBoardId = result.data.id;
      navigate(`/excalidraw/open/${newBoardId}`, { replace: true });
      setSaveStatus('saved');
      if (excalidrawAPI) excalidrawAPI.setToast({ message: "画板已创建", duration: 2000, closable: true });
      saveThumbnail(newBoardId.toString());
      return newBoardId;
    } catch (error) {
      console.error('创建画板失败:', error);
      setSaveStatus('error');
      if (excalidrawAPI) excalidrawAPI.setToast({ message: "创建失败，请重试", duration: 3000, closable: true });
      throw error;
    }
  }, [navigate, excalidrawAPI, saveThumbnail, boardTitle]);

  const updateBoard = useCallback(async (id: string, elements: any[], appState: AppState, files: BinaryFiles, title?: string) => {
    try {
      setSaveStatus('saving');
      const boardData = {
        ...(title !== undefined && { name: title }),
        file_content: {
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements,
          appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize, theme: appState.theme },
          files,
        },
      };
      const response = await fetch(`${HOST_URL}/api/excalidraw/boards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(boardData),
      });
      if (!response.ok) throw new Error('更新失败');
      setSaveStatus('saved');
      if (excalidrawAPI) excalidrawAPI.setToast({ message: "画板已更新", duration: 2000, closable: true });
      saveThumbnail(id);
    } catch (error) {
      console.error('更新画板失败:', error);
      setSaveStatus('error');
      if (excalidrawAPI) excalidrawAPI.setToast({ message: "更新失败，请重试", duration: 3000, closable: true });
    }
  }, [excalidrawAPI, saveThumbnail]);

  const loadBoard = useCallback(async (id: string) => {
    try {
      setLoadStatus('loading');
      const response = await fetch(`${HOST_URL}/api/excalidraw/boards/${id}`, { method: 'GET', headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } });
      if (!response.ok) throw new Error('加载失败');
      const result = await response.json();
      const boardData = result.data;
      if (boardData.name) {
        setBoardTitle(boardData.name);
        document.title = boardData.name;
      }
      let sceneData;
      try { sceneData = JSON.parse(boardData.board_json); } catch { throw new Error('画板数据格式错误'); }
      if (excalidrawAPI && sceneData) {
        excalidrawAPI.updateScene({ elements: sceneData.elements || [], appState: { ...sceneData.appState, isLoading: false } });
        if (sceneData.files) excalidrawAPI.addFiles(Object.values(sceneData.files));
      }
      setLoadStatus('loaded');
      if (excalidrawAPI) excalidrawAPI.setToast({ message: "画板已加载", duration: 2000, closable: true });
    } catch (error) {
      console.error('加载画板失败:', error);
      setLoadStatus('error');
      if (excalidrawAPI) excalidrawAPI.setToast({ message: "加载失败，请重试", duration: 3000, closable: true });
    }
  }, [excalidrawAPI]);

  const handleChange = useCallback((elements: readonly any[], appState: AppState, files: BinaryFiles) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (elements.length === 0) return;
    saveTimeoutRef.current = window.setTimeout(() => {
      if (isNewBoard) createBoard([...elements], appState, files);
      else if (boardId) updateBoard(boardId, [...elements], appState, files);
    }, 30000);
    setSaveStatus('idle');
  }, [isNewBoard, boardId, createBoard, updateBoard]);

  const handleManualSave = useCallback(() => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();
    if (isNewBoard) createBoard([...elements], appState, files);
    else if (boardId) updateBoard(boardId, [...elements], appState, files);
  }, [excalidrawAPI, isNewBoard, boardId, createBoard, updateBoard]);

  useEffect(() => {
    if (excalidrawAPI && boardId && !isNewBoard && parseInt(boardId) > 0) {
      loadBoard(boardId);
    } else if (isNewBoard) {
      setBoardTitle('');
      document.title = '画板';
    }
  }, [excalidrawAPI, boardId, isNewBoard, loadBoard]);

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

  if (!boardId && !isNewBoard) {
    return (
      <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "#666" }}>
        错误：未找到画板ID
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
            <MainMenu.Item onSelect={handleNewBoard}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><IconNew />{menuLabels.newLabel}</span></MainMenu.Item>
            <MainMenu.Item onSelect={handleManualSave} disabled={saveStatus === 'saving' || loadStatus === 'loading'}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><IconSave />{menuLabels.saveLabel}</span></MainMenu.Item>
            <MainMenu.Item onSelect={() => { setRenameValue(boardTitle); setIsRenameOpen(true); }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><IconRename />{menuLabels.renameLabel}</span></MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Separator />
            <MainMenu.Item onSelect={handleBack}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><IconBack />{menuLabels.backLabel}</span></MainMenu.Item>
          </MainMenu>
        </Excalidraw>
        {isRenameOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#ffffff', width: 'min(520px, 92vw)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', padding: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{menuLabels.renameLabel}</div>
              <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder={langCode === 'en' ? 'Enter a new title' : '请输入新标题'} style={{ width: '100%', height: 40, padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 14, outline: 'none' }} onKeyDown={(e) => { if (e.key === 'Enter') { const btn = document.getElementById('rename-confirm-btn') as HTMLButtonElement | null; btn?.click(); } }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={() => setIsRenameOpen(false)} style={{ height: 36, padding: '6px 12px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, cursor: 'pointer' }}>{langCode === 'en' ? 'Cancel' : '取消'}</button>
                <button id="rename-confirm-btn" onClick={() => {
                  const nextTitle = renameValue.trim();
                  if (!nextTitle) { setIsRenameOpen(false); return; }
                  setBoardTitle(nextTitle);
                  document.title = nextTitle;
                  if (excalidrawAPI) {
                    const elements = excalidrawAPI.getSceneElements();
                    const appState = excalidrawAPI.getAppState();
                    const files = excalidrawAPI.getFiles();
                    if (isNewBoard) createBoard([...elements], appState, files, nextTitle);
                    else if (boardId) updateBoard(boardId, [...elements], appState, files, nextTitle);
                  }
                  setIsRenameOpen(false);
                }} style={{ height: 36, padding: '6px 14px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{langCode === 'en' ? 'Save' : '保存'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


