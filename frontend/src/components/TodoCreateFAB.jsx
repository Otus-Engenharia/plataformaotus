import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import TodoCreateDialog from '../pages/todos/components/TodoCreateDialog';
import './TodoCreateFAB.css';

/**
 * Floating Action Button para criar ToDo's rapidamente
 * Aparece em todas as páginas (exceto login/home)
 */
export default function TodoCreateFAB() {
  const { user } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [favoriteProjects, setFavoriteProjects] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!isDialogOpen) return;

    async function fetchData() {
      try {
        const [projRes, favRes, usersRes] = await Promise.all([
          axios.get('/api/todos/projects', { withCredentials: true }),
          axios.get('/api/todos/favorite-projects', { withCredentials: true }),
          axios.get('/api/todos/users', { withCredentials: true }),
        ]);
        if (projRes.data.success) setProjects(projRes.data.data || []);
        if (favRes.data.success) setFavoriteProjects(favRes.data.data || []);
        if (usersRes.data.success) {
          const fetchedUsers = usersRes.data.data || [];
          // Fallback: se o usuário logado não está na lista (ex: status desativado),
          // adiciona como opção temporária para permitir pré-seleção
          if (user?.id && !fetchedUsers.some(u => u.id === user.id)) {
            fetchedUsers.push({ id: user.id, name: user.name || user.email });
          }
          setUsers(fetchedUsers);
        }
      } catch (err) {
        console.error('Erro ao carregar dados para criar ToDo:', err);
      }
    }

    fetchData();
  }, [isDialogOpen]);

  const handleSave = async (formData) => {
    try {
      const res = await axios.post('/api/todos', formData, { withCredentials: true });
      if (res.data.success) {
        setIsDialogOpen(false);
      }
    } catch (err) {
      console.error('Erro ao criar ToDo:', err);
    }
  };

  return (
    <>
      <button
        className={`todo-fab ${isHovered ? 'todo-fab--expanded' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsDialogOpen(true)}
        title="Nova Tarefa"
        aria-label="Nova Tarefa"
      >
        <svg
          className="todo-fab__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
        <span className="todo-fab__text">Nova Tarefa</span>
      </button>

      {isDialogOpen && (
        <TodoCreateDialog
          todo={null}
          defaultAssignee={user?.id}
          projects={projects}
          favoriteProjects={favoriteProjects}
          users={users}
          onSave={handleSave}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
}
