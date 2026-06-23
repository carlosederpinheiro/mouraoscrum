import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { MacroAreaWithProjects, Company, Staff, Task } from '../types';
import { toast } from 'sonner';
import { useConfirm } from './useConfirm';
import { mapStatusFromDB } from '../lib/utils';

export function useScrumData() {
  const { confirm } = useConfirm();
  const [data, setData] = useState<MacroAreaWithProjects[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const [personalTasks, setPersonalTasks] = useState<Task[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [
        { data: macroAreas },
        { data: projectsTable },
        { data: sprintsTable },
        { data: tasksTable },
        { data: companiesTable },
        { data: profilesTable },
        { data: projectMembersTable },
        { data: taskAssigneesTable },
        { data: personalTasksTable },
        { data: taskChecklistsTable },
        { data: personalTaskChecklistsTable }
      ] = await Promise.all([
        supabase.from('macro_areas').select('*').order('name'),
        supabase.from('projects').select('*').order('name'),
        supabase.from('sprints').select('*').order('title'),
        supabase.from('tasks').select('*').order('title'),
        supabase.from('companies').select('*').order('name'),
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('project_members').select('*'),
        supabase.from('task_assignees').select('*'),
        supabase.from('personal_tasks').select('*').order('due_date', { ascending: true }),
        supabase.from('task_checklists').select('*').order('created_at', { ascending: true }),
        supabase.from('personal_task_checklists').select('*').order('created_at', { ascending: true })
      ]);

      if (macroAreas && projectsTable && sprintsTable && tasksTable) {
        const enrichedData: MacroAreaWithProjects[] = macroAreas.map(ma => ({
          ...ma,
          projects: (projectsTable || [])
            .filter(p => p.macro_area_id === ma.id)
            .map(p => ({
              ...p,
              staff_ids: (projectMembersTable || [])
                .filter(pm => pm.project_id === p.id)
                .map(pm => pm.profile_id),
              sprints: (sprintsTable || [])
                .filter(s => s.project_id === p.id)
                .map(s => ({
                  ...s,
                  tasks: (tasksTable || []).filter(t => t.sprint_id === s.id).map(t => {
                    const assignees = (taskAssigneesTable || [])
                      .filter(ta => ta.task_id === t.id)
                      .map(ta => {
                        const profile = (profilesTable || []).find(p => p.id === ta.profile_id);
                        return profile ? profile.full_name : ta.profile_id;
                      });

                    const taskChecklists = (taskChecklistsTable || []).filter(c => c.task_id === t.id);
                    const company = t.company_id ? (companiesTable || []).find(c => c.id === t.company_id) : undefined;

                    return {
                      ...t,
                      status: mapStatusFromDB(t.status),
                      assignees,
                      checklists: taskChecklists,
                      companyName: company ? company.name : undefined,
                      macroAreaTitle: ma.name
                    };
                  })
                }))
            }))
        }));
        setData(enrichedData);
      }

      if (companiesTable) {
        const sortedCompanies = [...companiesTable].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setCompanies(sortedCompanies);
      }
      if (profilesTable) setStaff(profilesTable);
      
      if (personalTasksTable) {
        const enrichedPersonalTasks = personalTasksTable.map(pt => {
           const profile = (profilesTable || []).find(p => p.id === pt.profile_id);
           const personalChecklists = (personalTaskChecklistsTable || []).filter(c => c.personal_task_id === pt.id);
           return {
             ...pt,
             assignees: profile ? [profile.full_name] : [],
             checklists: personalChecklists.map(c => ({...c, task_id: pt.id})) // Map to expected shape
           };
        });
        setPersonalTasks(enrichedPersonalTasks);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

  const handleDeleteStaff = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remover Colaborador',
      message: 'Deseja realmente remover este membro do staff?'
    });
    if (confirmed) {
      try {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
        setStaff(prevStaff => prevStaff.filter(s => s.id !== id));
        toast.success('Colaborador removido com sucesso.');
      } catch (err: any) {
        toast.error('Erro ao excluir membro: ' + (err.message || 'Tente novamente.'));
      }
    }
  };

  const handleUpdateStaff = async (updatedStaff: Staff[]) => {
    setStaff(updatedStaff);
  };

  return {
    data,
    setData,
    companies,
    setCompanies,
    staff,
    setStaff,
    personalTasks,
    setPersonalTasks,
    fetchData,
    handleDeleteStaff,
    handleUpdateStaff
  };
}
